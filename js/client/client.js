jQuery.event.props.push('dataTransfer');
var app = angular.module('MonApp',['lvl.directives.dragdrop','ui.bootstrap','LocalStorageModule']);
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
        a = parseFloat(a[attribute]);
        b = parseFloat(b[attribute]);
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
			//$http({method: 'GET', url: 'http://10.59.14.102:8080/aboutCluster'})
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
			var tables = [];
			var tablesFound = [];
			var totalWeight = 0;
			var num = 0;
			var denum = scope.dataServer.servers.length;

			angular.forEach(scope.dataServer.servers, function(server, index){

				var tmpWeightValue = 0;
				angular.forEach(server.shards, function(shard, index){
					shard.weight = parseFloat(shard.weight.toFixed(4));
					tmpWeightValue = tmpWeightValue + parseFloat(shard.weight);
					if($.inArray(shard.table, tablesFound) == -1){
						tablesFound.push(shard.table);
						
						tableToAdd = {
							name : shard.table,
							selected : true
						};
						tables.push(tableToAdd);
					}
				});
				server.weight = parseFloat(tmpWeightValue.toFixed(4));
				num = num + tmpWeightValue;

				totalWeight = totalWeight + parseFloat(tmpWeightValue);
			});
			scope.totalWeight = totalWeight;
			scope.average = num / denum;
			scope.tables = tables;

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

app.controller('MainController',function ($scope, $modal, NetFactory, localStorageService){
		
		//Partie pour récupération de données depuis le web

		init = function(){
			$scope.datas = NetFactory.getServerDatas().then(function(dataServer){
				if(dataServer.error != undefined){
					$scope.openModal('loading');
				}
				else{
					$scope.dataServer = dataServer;
					$scope.serversToSplit = [];
					$scope.splitServers = [];
					$scope.changes = [];
					$scope.tmpTableGroup = [];
					$scope.tableGroups = [];
					$scope.refreshBool = false;
					$scope.refreshCount = 0;
					$scope.selectedAll = true;
					$scope.loading = false;
					NetFactory.calculateDatas($scope);

					calculateWorstImbalance();
				}
			}, function(msg){
				alert(msg);
			});
		};
		
		init();
		
		$scope.saveModifications = function(){
			localStorageService.clearAll();
			localStorageService.set('storedChanges', angular.copy($scope.changes));
			console.log('data saved');
		};
		$scope.loadModifications = function(){
			$scope.abortChanges();
			$scope.changes = localStorageService.get('storedChanges');
			$scope.applyChangement($scope.changes);
			console.log('data loaded');
		};
		$scope.applyChangement = function(changes){
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
							}
						});
					}
				});
				//Mise à jour des poids
				$scope.dataServer.servers[indexDroppedServer].weight = parseFloat((parseFloat($scope.dataServer.servers[indexOriginServer].shards[indexShardToSplice].weight) + parseFloat($scope.dataServer.servers[indexDroppedServer].weight)).toFixed(4));
				$scope.dataServer.servers[indexOriginServer].weight = parseFloat((parseFloat($scope.dataServer.servers[indexOriginServer].weight) - parseFloat($scope.dataServer.servers[indexOriginServer].shards[indexShardToSplice].weight)).toFixed(4));

				//Mise a jour des listes
				var newShard = {
					id : change.idShard,
					weight : parseFloat($scope.dataServer.servers[indexOriginServer].shards[indexShardToSplice].weight.toFixed(4)),
					table : $scope.dataServer.servers[indexOriginServer].shards[indexShardToSplice].table
				};
				$scope.dataServer.servers[indexDroppedServer].shards.push(newShard);
				$scope.dataServer.servers[indexOriginServer].shards.splice(indexShardToSplice, 1);
				
				notifyChanges(change.idShard, change.idOrigin, change.idDest);
				calculateWorstImbalance();
			});
		};
		$scope.applyModifications = function(){
			NetFactory.postChanges($scope);
			$scope.openModal('loading');
		};
		$scope.automaticBalance = function(){
			var changes = bruteForceAlgorithm.optimize($scope.dataServer);
			if(changes.length == 0){
				$scope.openModal('automaticBalance');
			}
			$scope.applyChangement(changes);
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
			$scope.dataServer.servers[indexDroppedServer].weight = parseFloat((parseFloat(draggedElement.attr("weight")) + parseFloat($scope.dataServer.servers[indexDroppedServer].weight)).toFixed(4));
			$scope.dataServer.servers[indexOriginServer].weight = parseFloat((parseFloat($scope.dataServer.servers[indexOriginServer].weight) - parseFloat(draggedElement.attr("weight"))).toFixed(4));

			//Mise a jour des listes
			var newShard = {
				id : draggedElement.attr("shardId"),
				weight : parseFloat(draggedElement.attr("weight")),
				table : draggedElement.attr("tableName")
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
        	var shardWeight = parseFloat(weight);
        	var serverWeight = parseFloat(sWeight);

        	percentValue = (shardWeight * 100) / serverWeight;
        	//$scope.weightWarningType(weight, sWeight);
        	return percentValue;
        };
        $scope.weightWarningType = function(weight, sWeight) {
        	//console.log('fonction weightWarningType');
        	var type;
        	var percentValue = 0;
        	var shardWeight = parseFloat(weight);
        	var serverWeight = parseFloat(sWeight);

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
        	var shardWeight = parseFloat(weight);
			
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
        	imbalance = Math.abs((parseFloat(serverWeight) - $scope.average));
        	return imbalance;
        };
        calculateWorstImbalance = function(){
        	//console.log('fonction calculateWorstImbalance');
        	var worstWeight = 0;
        	var worstImbalance = 0;
        	angular.forEach($scope.dataServer.servers, function(server, index){
        		if(server.weight > worstWeight){
        			worstWeight = parseFloat(server.weight);
        		}
        		if( Math.abs(parseFloat(server.weight) - $scope.average) > worstImbalance) {
        			worstImbalance = Math.abs(parseFloat(server.weight) - $scope.average);
        		}
        	});
        	$scope.worstImbalance = worstImbalance;
        	$scope.worstWeight = worstWeight;
        	$scope.firstLoop = true;
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
				weight : parseFloat($scope.dataServer.servers[indexDest].shards[indexToSplice].weight.toFixed(4)),
				table : $scope.dataServer.servers[indexDest].shards[indexToSplice].table
			};
        	
        	//Mise à jour poids
        	$scope.dataServer.servers[indexDest].weight = parseFloat((parseFloat($scope.dataServer.servers[indexDest].weight) - parseFloat(newShard.weight)).toFixed(4));
        	$scope.dataServer.servers[indexSource].weight = parseFloat((parseFloat($scope.dataServer.servers[indexSource].weight) + parseFloat(newShard.weight)).toFixed(4));
        	
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

        $scope.addToTmp = function(table){
        	if($.inArray(table, $scope.tmpTableGroup) == -1){
        		$scope.tmpTableGroup.push(table);
        		$scope.tmpGroupCreateDisabled = true;
        	}
        };
        $scope.removeFromTmp = function(table){
        	var indexFound = 0;
        	angular.forEach($scope.tmpTableGroup, function(tmpTable, index){
        		if(tmpTable.name == table.name){
        			indexFound = index;
        		}
        	});
        	$scope.tmpTableGroup.splice(indexFound, 1);
        	if($scope.tmpTableGroup.length == 0){
        		$scope.tmpGroupCreateDisabled = false;
        	}
        };
        $scope.createGroup = function(tmpGroupName){
        	if(tmpGroupName != undefined){
	        	$scope.tmpTableGroup.name = angular.copy(tmpGroupName);
	        	$scope.tmpTableGroup.selected = true;
	        	$scope.tableGroups.push($scope.tmpTableGroup);
	        	$scope.tmpTableGroup = [];
	        	$scope.tmpGroupName = undefined;
	        	$scope.tmpGroupCreateDisabled = false;
        	}
        };
        $scope.removeGroup = function(groupToRemove){
        	var indexFound;
        	angular.forEach($scope.tableGroups, function(group, index){
        		if(groupToRemove.name == group.name){
        			indexFound = index;
        		}
        	});
        	angular.forEach($scope.tableGroups[indexFound], function(table, index){
        		table.selected = true;
        	});
        	$scope.tableGroups.splice(indexFound, 1);
        };
        $scope.manageGroupVision = function(group){
        	group.selected = !group.selected;
        	
        	angular.forEach(group, function(table, index){
        		table.selected = group.selected;
        	});
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
        $scope.checkAll = function () {
	        if ($scope.selectedAll) {
	            $scope.selectedAll = false;
	        } else {
	            $scope.selectedAll = true;
	        }
	        angular.forEach($scope.tables, function (item) {
	            item.selected = $scope.selectedAll;
	        });
    	};
    	$scope.showShard = function(shard){
    		var show = false;
    		var tables = angular.copy($scope.tables);
    		angular.forEach(tables, function(table, index){
    			if(table.name == shard.table){
    				show = table.selected;
    			}
    		});

    		return show;
    	};
		$scope.sayHello = function(){
			$scope.greeting = 'Hello';
		};     

		$scope.consoleMe = function(){
			console.log($scope.worstImbalance);
		};
		$scope.clearManipZone = function(){
			$scope.serversToSplit = [];
			$scope.splitServers = [];
		};
		$scope.recur = function(modalInstance){
			var initval = 100;
			$scope.datas = NetFactory.getServerDatas().then(function(dataServer){
				$scope.loadingInfos = dataServer.error;
				
				if(dataServer.error == undefined){
					$scope.loading = false;
					modalInstance.close();
					init();
				}
			}, function(msg){
				alert(msg);
			});

			$({value: 0}).animate({value: initval}, {
				duration: 2000,
				easing:'swing',
				step: function()
				{
					$('.dial').val(this.value).trigger('change');
					$('#preval').val(initval);
				},
				
				complete: function()
				{	
					$('.dial').val(this.value).trigger('change');
					if($scope.loading){
						$scope.recur(modalInstance);
					}		
				}
			});	
		};
		$scope.openModal = function (modalType) {
			var modalInstance;
			if(modalType == 'automaticBalance'){
			    modalInstance = $modal.open({
				    templateUrl: 'modalNoBalanceFound.html',
				    controller: ModalInstanceCtrl,
				    size: 0,
				    resolve: {
				    	items: function () {
				        	return $scope.dataServer.servers[0];
				        }
				    }
			    });
			}
			if(modalType == 'help'){
				modalInstance = $modal.open({
				    templateUrl: 'modalHelp.html',
				    controller: ModalInstanceCtrl,
				    size: 'lg',
				    resolve: {
				    	items: function () {
				        	return $scope.dataServer.servers[0];
				        }
				    }
			    });
			}
			if(modalType == 'loading'){
				$scope.loading = true;
				modalInstance = $modal.open({
				    templateUrl: 'modalLoading.html',
				    scope: $scope,
				    controller: ModalInstanceCtrl,
				    size: 0,
				    keyboard: false,
  					backdrop: 'static',
				    resolve: {
				    	items: function () {	
				        	return $scope;
				        },
				        errorMes: function(){
				        	return $scope;
				        } 
				    }
			    });
			    $scope.recur(modalInstance);
			}
		    modalInstance.result.then(function () {
		    }, function () {
		    	$scope.loading = false;
		    	console.log('Modal dismissed at: ' + new Date());
		    });
		};
	}
);

var ModalInstanceCtrl = function ($scope, $modalInstance, items) {

  $scope.ok = function () {
    $modalInstance.close();
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
};


 