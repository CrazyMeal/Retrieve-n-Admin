var bruteForceAlgorithm = {};

bruteForceAlgorithm.imbalanceToleranceRatio = 0.1;
bruteForceAlgorithm.maxIterations = 1000;
bruteForceAlgorithm.debug = true;

bruteForceAlgorithm.optimize = function(clusterGiven){
	var cluster = angular.copy(clusterGiven);
	if(cluster.servers.length == 0){
		console.log("No server to balance ; giving up");
		return [];
	}

	var avgWeight = this.calcAvgWeight(cluster);
	var worstImbalanceRatio = ((avgWeight == 0) ? 0 : this.worstImbalance(cluster, avgWeight)/avgWeight);
	if(worstImbalanceRatio <= this.imbalanceToleranceRatio){
		console.log("Skipping balancing for " + cluster + ": worst imbalance is " + worstImbalanceRatio + " while tolerating " + this.imbalanceToleranceRatio);
		return [];
	}

	var start = Date.now();
	var imbalanceStart = worstImbalanceRatio;

	var iteration = 0;
	var mostLoadedServer;
	do {
		iteration++;

		mostLoadedServer = this.getMostLoadedServer(cluster);
		var serverImbalance = this.imbalance(mostLoadedServer, avgWeight);
		if(this.debug)
			console.log("actual worst imbalance : "+serverImbalance+", for an avg weight of "+avgWeight);

		var shardToMove;
		var shardToMoveProximity = Number.MAX_VALUE;
		for(var j = 0; j < mostLoadedServer.shards.length; j++){
			var proximity = Math.abs(mostLoadedServer.shards[j].weight - serverImbalance);
			if(proximity < shardToMoveProximity && mostLoadedServer.shards[j].weight > 0){
				shardToMove = mostLoadedServer.shards[j];
				shardToMoveProximity = proximity;
				if (proximity == 0) {
					break;
				}
			}
		}
		if(this.debug)
				console.log("the shard "+shardToMove.id+" of weight "+shardToMove.weight+" will be moved");

		var serverImbalanceAbs = Math.abs(serverImbalance);

		var destinationServer;
		var destinationServerProximity = Number.MAX_VALUE;
		var destinationServerProximityAbs = destinationServerProximity;
		for (var i = 0; i < cluster.servers.length; i++) {
			if(cluster.servers[i] == mostLoadedServer){
				continue;
			}

			var proximity = Math.abs(shardToMove.weight + this.imbalance(cluster.servers[i], avgWeight));
			if(this.debug)
				console.log("shards can be moved on server "+cluster.servers[i].id+" and will have a proximity of "+proximity);
			var proximityAbs = Math.abs(proximity);
			if (proximityAbs < serverImbalanceAbs && (proximityAbs < destinationServerProximityAbs 
					|| proximityAbs == destinationServerProximityAbs && proximity < 0 && destinationServerProximity < 0)) {
				if(this.debug)
					console.log("this server is a valid destination");
				destinationServer = cluster.servers[i];
				destinationServerProximity = proximity;
				destinationServerProximityAbs = proximityAbs;
				if(proximity == 0)
					break;
			}
		}

		if(destinationServer == undefined){
			console.log("Cannot find suitable server to move " + shardToMove);
			break;
		}

		this.changeServer(cluster, shardToMove, destinationServer);
		if(this.debug)
			console.log("trying to move "+shardToMove.id+" (weight : "+shardToMove.weight+") to server "+destinationServer.id);

		var newWorstImbalanceRatio = this.worstImbalance(cluster)/avgWeight;
		if(newWorstImbalanceRatio > worstImbalanceRatio){
			console.log("Balancing algorithm is being degrading cluster balance ; stopping");
			if(this.debug)
				console.log("old imbalance ratio : "+worstImbalanceRatio+" new imbalance ratio : "+newWorstImbalanceRatio);
			this.changeServer(cluster, shardToMove, mostLoadedServer);
			break;
		}
		worstImbalanceRatio = newWorstImbalanceRatio;
	} while(worstImbalanceRatio > this.imbalanceToleranceRatio && iteration < this.maxIterations);

	var ret = [];
	if(worstImbalanceRatio < imbalanceStart){
		for (var i = 0; i < cluster.servers.length; i++) {
			for (var j = 0; j < cluster.servers[i].shards.length; j++) {
				if(cluster.servers[i].shards[j].originalServer != undefined 
					&& cluster.servers[i].shards[j].originalServer != cluster.servers[i]){
					var move = {};
					move.idShard = cluster.servers[i].shards[j].id;
					move.idOrigin = cluster.servers[i].shards[j].originalServer.id;
					move.idDest = cluster.servers[i].id;
					ret.push(move);
				}
			}
		}
	}
	else{
		for (var i = 0; i < cluster.servers.length; i++) {
			for (var j = 0; j < cluster.servers[i].shards.length; j++) {
				if(cluster.servers[i].shards[j].originalServer != undefined)
					this.changeServer(cluster, cluster.servers[i].shards[j], cluster.servers[i].shards[j].originalServer);
			}
		}
	}

	if(worstImbalanceRatio > this.imbalanceToleranceRatio){
		mostLoadedServer = this.getMostLoadedServer(cluster);
		var heavierShard;
		for (var i = 0; i < cluster.servers.length; i++) {
			for (var j = 0; j < cluster.servers[i].shards.length; j++) {
				if(heavierShard == undefined || parseFloat(cluster.servers[i].shards[j].weight) > parseFloat(heavierShard.weight))
					heavierShard = cluster.servers[i].shards[j];
			}
		}

		var newHeavierShard = this.getHeavierShard(cluster);
		var msg = "Stopping balancing after " + iteration + " iterations: "
 			+ "can't balance to avoid " + worstImbalanceRatio + " imbalance (trying to set "+imbalanceStart+" imbalance down to " + this.imbalanceToleranceRatio +") "
 			+ " ; most loaded server is " + mostLoadedServer + " (weight is "+ this.serverWeight(mostLoadedServer) +")"
 			+ " in which most loaded shard is " + heavierShard + " with weight " + heavierShard.weight + " while heavier shard in the cluster is " + newHeavierShard
 			+ " with weight " + newHeavierShard.weight + "\n"
 			+ " Best solution so far:"; 
 		console.log(msg);
	}
	else{
		console.log("Found balancing solution ratio improving imbalance ratio from " + imbalanceStart + " to " + worstImbalanceRatio + " in " + (Date.now()-start) + "ms (" + iteration + " iterations):");
	}
	for (var i = 0; i < ret.length; i++) {
			console.log("moving shard : "+ret[i].idShard+" from server :"+ret[i].idOrigin+" to server : "+ret[i].idDest);
	}
	return ret;
};

bruteForceAlgorithm.calcAvgWeight = function(cluster){
	var avg = 0;
	var nb = 0;
	for (var i = 0; i < cluster.servers.length; i++) {
		for (var j = 0; j < cluster.servers[i].shards.length; j++) {
			avg+=parseFloat(cluster.servers[i].shards[j].weight);
		}
		nb++;
	}
	return avg/nb;
};

bruteForceAlgorithm.worstImbalance = function(cluster, avgWeight){
	if(avgWeight==undefined)
		avgWeight = this.calcAvgWeight(cluster);

	var worstImbalance = 0;
	var weight = 0;
	for (var i = 0; i < cluster.servers.length; i++) {
		weight = 0;
		for (var j = 0; j < cluster.servers[i].shards.length; j++) {
			weight+=parseFloat(cluster.servers[i].shards[j].weight);
		}
		weight = Math.abs(weight-avgWeight);
		if(weight>worstImbalance)
			worstImbalance = weight;
	}
	return worstImbalance;
};

bruteForceAlgorithm.getMostLoadedServer = function(cluster){
	var maxWeight = 0;
	var weight = 0;
	var server;
	for (var i = 0; i < cluster.servers.length; i++) {
		weight = 0;
		for (var j = 0; j < cluster.servers[i].shards.length; j++) {
			weight+=parseFloat(cluster.servers[i].shards[j].weight);
		}
		if(weight>maxWeight){
			maxWeight = parseFloat(weight);
			server = cluster.servers[i];
		}
	}
	return server;
};

bruteForceAlgorithm.imbalance = function(server, avgWeight){
	var weight = 0;
	for (var j = 0; j < server.shards.length; j++) {
			weight+=parseFloat(server.shards[j].weight);
	}
	return weight-avgWeight;
};

bruteForceAlgorithm.changeServer = function(cluster, shardToMove, destinationServer){
	for (var i = 0; i < cluster.servers.length; i++) {
		weight = 0;
		for (var j = 0; j < cluster.servers[i].shards.length; j++) {
			if(shardToMove.id == cluster.servers[i].shards[j].id){
				cluster.servers[i].shards.splice(j,1);
				if(shardToMove.originalServer == undefined)
					shardToMove.originalServer = cluster.servers[i];
			}
		}
		if(cluster.servers[i].id == destinationServer.id){
			cluster.servers[i].shards.push(shardToMove);
		}
	}
};

bruteForceAlgorithm.getHeavierShard = function(cluster){
	var heavier;
	var weight;
	var maxWeight = 0;
	for (var i = 0; i < cluster.servers.length; i++) {
		for (var j = 0; j < cluster.servers[i].shards.length; j++) {
			weight = parseFloat(cluster.servers[i].shards[j].weight);
			if(weight > maxWeight){
				maxWeight = weight;
				heavier = cluster.servers[i].shards[j];
			}
		}
	}
	return heavier;
};

bruteForceAlgorithm.serverWeight = function(server){
	var weight = 0;
	for (var j = 0; j < server.shards.length; j++) {
		weight += parseFloat(server.shards[j].weight);
	}
	return weight;
};