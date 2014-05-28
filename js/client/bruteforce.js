var bruteForceAlgorithm = {};

bruteForceAlgorithm.imbalanceToleranceRatio = 0.1;
bruteForceAlgorithm.maxIterations = 1000;
bruteForceAlgorithm.debug = false;

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

			var proximity = shardToMove.weight + this.imbalance(cluster.servers[i], avgWeight);
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
				if(heavierShard == undefined || cluster.servers[i].shards[j].weight > heavierShard.weight)
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
}

bruteForceAlgorithm.calcAvgWeight = function(cluster){
	var avg = 0;
	var nb = 0;
	for (var i = 0; i < cluster.servers.length; i++) {
		for (var j = 0; j < cluster.servers[i].shards.length; j++) {
			avg+=cluster.servers[i].shards[j].weight;
		}
		nb++;
	}
	return avg/nb;
}

bruteForceAlgorithm.worstImbalance = function(cluster, avgWeight){
	if(avgWeight==undefined)
		avgWeight = this.calcAvgWeight(cluster);

	var worstImbalance = 0;
	var weight = 0;
	for (var i = 0; i < cluster.servers.length; i++) {
		weight = 0;
		for (var j = 0; j < cluster.servers[i].shards.length; j++) {
			weight+=cluster.servers[i].shards[j].weight;
		}
		weight = Math.abs(weight-avgWeight);
		if(weight>worstImbalance)
			worstImbalance = weight;
	}
	return worstImbalance;
}

bruteForceAlgorithm.getMostLoadedServer = function(cluster){
	var maxWeight = 0;
	var weight = 0;
	var server;
	for (var i = 0; i < cluster.servers.length; i++) {
		weight = 0;
		for (var j = 0; j < cluster.servers[i].shards.length; j++) {
			weight+=cluster.servers[i].shards[j].weight;
		}
		if(weight>maxWeight){
			maxWeight = weight;
			server = cluster.servers[i];
		}
	}
	return server;
}

bruteForceAlgorithm.imbalance = function(server, avgWeight){
	var weight = 0;
	for (var j = 0; j < server.shards.length; j++) {
			weight+=server.shards[j].weight;
	}
	return weight-avgWeight;
}

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
}

bruteForceAlgorithm.getHeavierShard = function(cluster){
	var heavier;
	var weight;
	var maxWeight = 0;
	for (var i = 0; i < cluster.servers.length; i++) {
		for (var j = 0; j < cluster.servers[i].shards.length; j++) {
			weight = cluster.servers[i].shards[j].weight;
			if(weight > maxWeight){
				maxWeight = weight;
				heavier = cluster.servers[i].shards[j];
			}
		}
	}
	return heavier;
}

bruteForceAlgorithm.serverWeight = function(server){
	var weight = 0;
	for (var j = 0; j < server.shards.length; j++) {
		weight += server.shards[j].weight;
	}
	return weight;
}

//bruteForceAlgorithm.optimize({"servers":[{"id":"portable-robin:60205","shards":[{"id":"test,row0.46448295027948916,1400578655617.9b57dc5707ddb43eb2ad1c4019a015b2.","weight":33.492268062010325},{"id":"test,row0.3104952012654394,1400578655617.3a2816f30fcfa8d404bb1d1296fa88d4.","weight":21.042239930290418}]},{"id":"portable-robin:60204","shards":[{"id":"test,row0.983185593271628,1400578655625.8aba411929d0259b86784eff43e57087.","weight":25.189558464556917},{"id":"test,row0.824470394756645,1400578655625.9561b2ee7a443c9fe40d888bb9dfa826.","weight":40.283378694745615}]},{"id":"portable-robin:60203","shards":[{"id":"server.cluster.RegionsStat,,1400578648113.475b3a0bb6b7fba8a85c5ef58f81d46a.","weight":20.45235963038763},{"id":"server.cluster.RegionsStat,7ffffeb9fa804be7,1400578648503.72e8c3c9a480161cf01b02ef49b0d949.","weight":0.3020669328563874},{"id":"server.cluster.RegionsStat,7ffffeb9fa693619,1400578648503.5bdc23d7926e9a85fb4a22a3de52c744.","weight":0.47165275792199757},{"id":"test,row0.30231216363608837,1400160543617.00357ad988dd8e426e434895062d2fe2.","weight":25.258073416643107},{"id":"server.cluster.RegionsStat,7ffffeb9fa678fef,1400578648113.92660f33d40c23ddafd4a4a2da99be86.","weight":24.58537264253084}]},{"id":"portable-robin:60020","shards":[{"id":".META.,,1","weight":31.922702434852653},{"id":"test,row0.6141315887216479,1400144331985.7a4d8347f7d383b9c85903caebfda48c.","weight":11.163738310083332},{"id":"-ROOT-,,0","weight":4.992975804837196},{"id":"test,row0.6039904670324177,1400160544476.d290cb9761abb64f6857b3a1008b3ccf.","weight":21.288259291875228}]},{"id":"portable-robin:60202","shards":[{"id":"test,,1400578655591.af0729576b499cc0c7ad607aa2b15cdd.","weight":47.25682356249252},{"id":"server.cluster.RegionsStat,7ffffeb9fab109f9,1400578648121.297894169de3a04a664e8677cff8eab3.","weight":37.55194065233679},{"id":"test,row0.7869106787256896,1400578655977.d597050622dccdf33794d1e9ff2cc917.","weight":32.42691699336724},{"id":"test,row0.6266481729689986,1400578655977.b1e68f0b3a4a4ed3bf2dfa5a8d2f6364.","weight":46.9984438477117},{"id":"server.cluster.RegionsStat,7ffffeb9fac99f5b,1400578648121.643c2b630ae3f334047411b3e53d911d.","weight":17.988276392087805},{"id":"test,row0.29743659938685596,1400578660202.86bf34ea3a4851533f03b9ad026d2b9e.","weight":27.934716479821375},{"id":"server.cluster.RegionsStat,7ffffeb9fa97ee9d,1400578641545.cc922e7a840072c3e83969488ef7d6d6.","weight":35.526099390722656},{"id":"test,row0.1505699495319277,1400578660202.f07c4e57b387868cd6149c111515f09c.","weight":13.737411964240149}]}]})
/*
bruteForceAlgorithm.optimize({
    "cluster": 0,
    "servers": [
        {
            "id": 0,
            "shards": [
                {
                    "id": "s0s001010101010100101010101010100101010100101010100101010100101100101010101010010101010101010010101010",
                    "weight": 10
                },
                {
                    "id": "s0s1",
                    "weight": 20
                },
                {
                    "id": "s0s2",
                    "weight": 50
                }
            ]
        },
        {
            "id": 1,
            "shards": [
                {
                    "id": "s1s0",
                    "weight": 30
                },
                {
                    "id": "s1s1",
                    "weight": 30
                }
            ]
        },
        {
            "id": 2,
            "shards": [
                {
                    "id": "s2s0",
                    "weight": 7
                },
                {
                    "id": "s2s1",
                    "weight": 3
                }
            ]
        },
        {
            "id": 3,
            "shards": [
                {
                    "id": "s3s0",
                    "weight": 27
                },
                {
                    "id": "s3s1",
                    "weight": 80
                }
            ]
        },
        {
            "id": 4,
            "shards": [
                {
                    "id": "s4s0",
                    "weight": 18
                },
                {
                    "id": "s4s1",
                    "weight": 33
                }
            ]
        },
        {
            "id": 5,
            "shards": [
                {
                    "id": "s5s0",
                    "weight": 14
                },
                {
                    "id": "s5s1",
                    "weight": 25
                }
            ]
        }
    ]
});
*/