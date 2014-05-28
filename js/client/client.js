jQuery.event.props.push('dataTransfer');
var app = angular.module('MonApp',['lvl.directives.dragdrop','ui.bootstrap']);
/*
app.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
}]);
*/
app.filter('orderObjectBy', function(){
 return function(input, attribute) {
    if (!angular.isObject(input)) return input;

    var array = [];
    for(var objectKey in input) {
        array.push(input[objectKey]);
    }

    array.sort(function(a, b){
        a = parseInt(a[attribute]);
        b = parseInt(b[attribute]);
        return a < b;
    });
    return array;
 }
});
app.factory('NetFactory', function($http, $q){
	var factory = {
		getServerDatas : function(){
			var deferred = $q.defer();
			//http://10.59.14.102:8080/aboutCluster
			$http({method: 'GET', url: 'tmp/FormeJsonCluster.json'})
				.success(function(data, status){
					factory.dataServer = data;
					deferred.resolve(factory.dataServer);
				})
				.error(function(data, status, headers, config){
					deferred.reject('Impossible de recuperer les datas');
				});
			return deferred.promise;
		},
		calculateDatas : function(scope){

			var totalWeight = 0;
			var num = 0;
			var denum = scope.dataServer.servers.length;

			angular.forEach(scope.dataServer.servers, function(server, index){

				var tmpWeightValue = 0;
				angular.forEach(server.shards, function(shard, index){
					tmpWeightValue = tmpWeightValue + parseInt(shard.weight);
				});
				server.weight = tmpWeightValue;
				num = num + tmpWeightValue;

				totalWeight = totalWeight + parseInt(tmpWeightValue);
			});
			scope.totalWeight = totalWeight;
			scope.average = num / denum;

			angular.forEach(scope.dataServer.servers, function(server, value){
				server.imbalance = calculateImbalance(server.weight);
				server.isCollapsed = false;
			});
		},

		postChanges : function(scope){
			var deferred = $q.defer();
			$http({
			    url: 'http://10.59.14.102:8080/applyChanges',
			    dataType: 'json',
			    method: 'POST',
			    data: {'moves': scope.changes},
			    headers: {
			        "Content-Type": 'application/x-www-form-urlencoded; charset=UTF-8'
			    }

			}).success(function(response){
			}).error(function(error){
			});
		}
	};
	return factory;
});

app.controller('MainController',function ($scope, $modal, NetFactory){
		
		//Partie pour récupération de données depuis le web
		$scope.datas = NetFactory.getServerDatas().then(function(dataServer){
			$scope.dataServer = dataServer;
			$scope.serversToSplit = [];
			$scope.changes = [];
			$scope.refreshBool = false;
			$scope.refreshCount = 0;
			NetFactory.calculateDatas($scope);

			calculateWorstImbalance();
		}, function(msg){
			alert(msg);
		});

		$scope.applyModifications = function(){
			NetFactory.postChanges($scope);
		};
		$scope.automaticBalance = function(){
			var changes = bruteForceAlgorithm.optimize($scope.dataServer);
			angular.forEach(changes, function(change, index){
				
				var indexDroppedServer, indexOriginServer, indexShardToSplice;
				var shardFound = false;

				angular.forEach($scope.dataServer.servers, function(server, index){
					if(server.id == change.idDest){
						indexDroppedServer = index;
					}
					if(server.id == change.idOrigin){
						indexOriginServer = index;
					}
					if(!shardFound){
						angular.forEach(server.shards, function(shard, indexShard){
							if(shard.id == change.idShard){
								indexShardToSplice = indexShard;
								shardFound = true;
								console.log(server);
							}
						});
					}
				});
				console.log(indexShardToSplice);
				//Mise à jour des poids
				$scope.dataServer.servers[indexDroppedServer].weight = parseInt($scope.dataServer.servers[indexOriginServer].shards[indexShardToSplice].weight) + parseInt($scope.dataServer.servers[indexDroppedServer].weight);
				$scope.dataServer.servers[indexOriginServer].weight = parseInt($scope.dataServer.servers[indexOriginServer].weight) - parseInt($scope.dataServer.servers[indexOriginServer].shards[indexShardToSplice].weight);

				//Mise a jour des listes
				var newShard = {
					id : change.idShard,
					weight : $scope.dataServer.servers[indexOriginServer].shards[indexShardToSplice].weight
				};
				$scope.dataServer.servers[indexDroppedServer].shards.push(newShard);
				$scope.dataServer.servers[indexOriginServer].shards.splice(indexShardToSplice, 1);
				
				notifyChanges(change.idShard, change.idOrigin, change.idDest);
			});
		};

		modifyServer = function(idDroppedServer, draggedElement){
			//console.log('fonction modifyServer');
			var indexDroppedServer, indexOriginServer, indexShardToSplice;
			var shardFound = false;

			angular.forEach($scope.dataServer.servers, function(server, index){
				if(server.id == idDroppedServer){
					indexDroppedServer = index;
				}
				if(server.id == draggedElement.attr("serverId")){
					indexOriginServer = index;
				}
				if(!shardFound){
					angular.forEach(server.shards, function(shard, indexShard){
						if(shard.id == draggedElement.attr("shardId")){
							indexShardToSplice = indexShard;
							shardFound = true;
						}
					});
				}
			});
			//Mise à jour des poids
			$scope.dataServer.servers[indexDroppedServer].weight = parseInt(draggedElement.attr("weight")) + parseInt($scope.dataServer.servers[indexDroppedServer].weight);
			$scope.dataServer.servers[indexOriginServer].weight = parseInt($scope.dataServer.servers[indexOriginServer].weight) - parseInt(draggedElement.attr("weight"));

			//Mise a jour des listes
			var newShard = {
				id : draggedElement.attr("shardId"),
				weight : draggedElement.attr("weight")
			};
			$scope.dataServer.servers[indexDroppedServer].shards.push(newShard);
			$scope.dataServer.servers[indexOriginServer].shards.splice(indexShardToSplice, 1);

			draggedElement.attr("serverId", idDroppedServer);
			//$scope.$apply();
		};
		notifyChanges = function(shardId, serverOriginId, serverDestId){
			change = {
				idShard: shardId,
				idOrigin: serverOriginId,
				idDest: serverDestId
			}
			if($scope.changes.length == 0){
				$scope.changes.push(change);
			} else {
				var containChange = false;
				var indexFound = 0;
				angular.forEach($scope.changes, function(changeInList, index){
					if(change.idShard == changeInList.idShard){
						containChange = true;
						indexFound = index;
					}
				});
				if(containChange){
					if($scope.changes[indexFound].idOrigin == change.idDest){
						$scope.changes.splice(indexFound, 1);
					} else {
						$scope.changes[indexFound].idDest = change.idDest;
					}
				} else {
					$scope.changes.push(change);
				}
			}
			change = {};
		};
		// Partie pour gérer le drag and drop des regions
		$scope.dropped = function(dragEl, dropEl) {
			//console.log('fonction dropped');
			var drop = angular.element(dropEl);
			var drag = angular.element(dragEl);
			
			//console.log("The element " + drag.attr('id') + " has been dropped on " + drop.attr("id") + "!");
			if( (drop.attr("serverId") != drag.attr("serverId")) && (drag.hasClass("shard") )){
				if(drop.hasClass("shards")){
					var sourceIndex, destIndex;
					angular.forEach($scope.dataServer.servers, function(server, index){
						if(server.id == drag.attr("serverId")){
							sourceIndex = index;
						}
						if(server.id == drop.attr("serverId")){
							destIndex = index;
						}
					});

					//notifyChanges(drag,drop);
					notifyChanges(drag.attr("shardId"),drag.attr("serverId"),drop.attr("serverId"));
					modifyServer(drop.attr("serverId"),drag);
					
					$scope.dataServer.servers[sourceIndex].imbalance = calculateImbalance($scope.dataServer.servers[sourceIndex].weight);
					$scope.dataServer.servers[destIndex].imbalance = calculateImbalance($scope.dataServer.servers[destIndex].weight);

					calculateWorstImbalance();
					$scope.$apply();
				}
			}
		};

		// Partie pour le drop de server dans la zone de manip
		$scope.droppedServer = function(dragEl, dropEl) {
			//console.log('fonction droppedServer');
			var drop = angular.element(dropEl);
			var drag = angular.element(dragEl);
			if(drag.hasClass("serverSlider")){
				angular.forEach($scope.dataServer.servers, function(server, index){
				if(server.id == drag.attr('serverId')){
					if($.inArray(server, $scope.serversToSplit) == -1){
						$scope.serversToSplit.push(server);
					}
				}
				});
				splitServers();
				$scope.$apply();
			}
		};
		$scope.droppedToRemove = function(dragEl, dropEl) {
			//console.log('fonction droppedServer');
			splitServers();
			var drop = angular.element(dropEl);
			var drag = angular.element(dragEl);
			if(drag.hasClass("serverHeader")){
				angular.forEach($scope.serversToSplit, function(server, index){
					if(server.id == drag.attr("serverId")){
							$scope.serversToSplit.splice(index,1);
						}
				});
			}
			splitServers();
			console.log($scope.splitServers);
			$scope.$apply();
		};
        $scope.weightPercent = function(weight, sWeight) {
        	//console.log('fonction weightPercent');
        	var percentValue = 0;
        	var shardWeight = parseInt(weight);
        	var serverWeight = parseInt(sWeight);

        	percentValue = (shardWeight * 100) / serverWeight;
        	//$scope.weightWarningType(weight, sWeight);
        	return percentValue;
        };
        $scope.weightWarningType = function(weight, sWeight) {
        	//console.log('fonction weightWarningType');
        	var type;
        	var percentValue = 0;
        	var shardWeight = parseInt(weight);
        	var serverWeight = parseInt(sWeight);

        	percentValue = (shardWeight * 100) / serverWeight;

        	if (percentValue < 25) {
		      type = 'success';
		    } else if (percentValue < 51) {
		      type = 'info';
		    } else if (percentValue < 75) {
		      type = 'warning';
		    } else {
		      type = 'danger';
		    }
        	return type;
        };
        $scope.weightBalanceWarningType = function(weight) {
        	//console.log('fonction weightBalanceWarningType');
        	var type;
        	var average = $scope.average;
        	var shardWeight = parseInt(weight);
			
			var imbalancePercent = (Math.abs((shardWeight - average)) * 100) / $scope.worstImbalance;
        	var averagePercent = (average * 100) / $scope.worstImbalance;

        	if (imbalancePercent < 25) {
		      type = 'success';
		    } else if (imbalancePercent < 50) {
		      type = 'info';
		    } else if (imbalancePercent < 75) {
		      type = 'warning';
		    } else {
		      type = 'danger';
		    }
        	return type;
        };
        $scope.refresh = function(server){
        	if(server.savedImbalance == undefined){
        		server.savedImbalance = server.imbalance;
        	}

        	if($scope.refreshBool == true){
        		angular.forEach($scope.dataServer.servers, function(server, index){
        			server.imbalance = calculateImbalance(server.weight);
        			server.savedImbalance = server.imbalance;
        		});
        		$scope.refreshBool = false;
        	}
        	return -server.savedImbalance;
        };
        splitServers = function(){
        	//console.log('fonction splitServers');
        	compSet = [];
        	$scope.splitServers = [];
        	
        	angular.forEach($scope.serversToSplit, function(serv,index){
        		var server = $scope.serversToSplit[index];
        		compSet.push(server);

				if( ((index+1) % 4) == 0){
				    $scope.splitServers.push(compSet);
				    compSet = [];
				}
				
        	});
        	$scope.splitServers.push(compSet);
        };
        calculateImbalance = function(serverWeight){
        	var imbalance = 0;
        	imbalance = Math.abs((parseInt(serverWeight) - $scope.average));
        	return imbalance;
        };
        calculateWorstImbalance = function(){
        	//console.log('fonction calculateWorstImbalance');
        	var worstWeight = 0;
        	var worstImbalance = 0;
        	angular.forEach($scope.dataServer.servers, function(server, index){
        		if(server.weight > worstWeight){
        			worstWeight = parseInt(server.weight);
        		}
        		if( Math.abs(parseInt(server.weight) - $scope.average) > worstImbalance) {
        			worstImbalance = Math.abs(parseInt(server.weight) - $scope.average);
        		}
        	});
        	$scope.worstImbalance = worstImbalance;
        	$scope.worstWeight = worstWeight;
        	$scope.firstLoop = true;
        	/*
        	if($scope.firstLoop){
        		$scope.firstLoop = false;
        	} else {
        		$scope.$apply();
        	}
        	*/
        };
        $scope.removeChange = function(changeToRemove){
        	angular.forEach($scope.changes, function(change, index){
        		if(change.idShard == changeToRemove.idShard){
        			$scope.changes.splice(index, 1);
        		}
        	});

        	var indexSource, indexDest, indexToSplice;

        	angular.forEach($scope.dataServer.servers, function(server, index){
        		if(server.id == changeToRemove.idOrigin){
        			indexSource = index;
        		}
        		if(server.id == changeToRemove.idDest){
        			indexDest = index;
        		}
        		angular.forEach(server.shards, function(shard, indexShard){
        			if(shard.id == changeToRemove.idShard){
        				indexToSplice = indexShard;
        			}
        		});
        	});
        	var newShard = {
				id : changeToRemove.idShard,
				weight : $scope.dataServer.servers[indexDest].shards[indexToSplice].weight
			};
        	
        	//Mise à jour poids
        	$scope.dataServer.servers[indexDest].weight = $scope.dataServer.servers[indexDest].weight - newShard.weight;
        	$scope.dataServer.servers[indexSource].weight = $scope.dataServer.servers[indexSource].weight + parseInt(newShard.weight);
        	
        	//Mise à jour des listes
        	$scope.dataServer.servers[indexDest].shards.splice(indexToSplice, 1);
        	$scope.dataServer.servers[indexSource].shards.push(newShard);

        	//Mise à jour des imbalances
        	$scope.dataServer.servers[indexSource].imbalance = calculateImbalance($scope.dataServer.servers[indexSource].weight);
			$scope.dataServer.servers[indexDest].imbalance = calculateImbalance($scope.dataServer.servers[indexDest].weight);

			calculateWorstImbalance();
        };
        $scope.abortChanges = function(){
			for (var i = $scope.changes.length - 1; i >= 0; i--) {
				$scope.removeChange($scope.changes[i]);
			};
        };
        $scope.highlightShard = function(idShard){
        	var shardQuery = $("#serverContainer").find("[shardId='"+ idShard +"']");
        	var shard = angular.element(shardQuery);
        	shard.css({
        		'background-color' : '#a8a8a8',
        		'border': '3px solid #CC1212' 
        	});
        };
        $scope.unHighlightShard = function(idShard){
        	var shardQuery = $("#serverContainer").find("[shardId='"+ idShard +"']");
        	var shard = angular.element(shardQuery);
        	shard.css({
        		'background-color' : '#dbdbdb',
        		'border': '' 
        	});
        };
		$scope.sayHello = function(){
			$scope.greeting = 'Hello';
		};     
	}
);


 