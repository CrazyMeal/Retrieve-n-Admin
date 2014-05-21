

jQuery.event.props.push('dataTransfer');
var app = angular.module('MonApp',['lvl.directives.dragdrop','ui.bootstrap']);
/*
app.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
}]);
*/
app.factory('NetFactory', function($http, $q){
	var factory = {
		getServerDatas : function(){
			var deferred = $q.defer();
			// http://10.75.0.168:8080/aboutCluster
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
		}
	};
	return factory;
});

app.controller('MainController',function ($scope, NetFactory){
		
		//Partie pour récupération de données depuis le web
		$scope.datas = NetFactory.getServerDatas().then(function(dataServer){
			$scope.dataServer = dataServer;
			$scope.serversToSplit = [];
			
			NetFactory.calculateDatas($scope);

			calculateWorstImbalance();
			/*
			angular.forEach($scope.dataServer.servers, function(server, value){
				server.imbalance = calculateImbalance(server.weight);
			});
		*/
		}, function(msg){
			alert(msg);
		});

		modifyServer = function(idDroppedServer, draggedElement){
			//console.log('fonction modifyServer');
			// Calcul du nouveau poid du server de destination
			angular.forEach($scope.dataServer.servers, function(value, key){
				if(value.id == idDroppedServer){
					var tmpDragWeight = parseInt(draggedElement.attr("weight"));
					var tmpDropWeight = parseInt(value.weight);

					value.weight = tmpDragWeight + tmpDropWeight;

					var newShard = {
						id : draggedElement.attr("shardId"),
						weight : draggedElement.attr("weight")
					};
					value.shards.push(newShard);
				}
			});
			// Calcul du nouveau poid du server d'origine
			angular.forEach($scope.dataServer.servers, function(value, key){
				if(value.id == draggedElement.attr("serverId")){
					var tmpDragWeight = parseInt(draggedElement.attr("weight"));
					var tmpOriginWeight = parseInt(value.weight);
					value.weight = tmpOriginWeight - tmpDragWeight;

					//On retire la region de son server d'origine
					angular.forEach(value.shards,function(shard, index){
						if(shard.id == draggedElement.attr("shardId")){
							value.shards.splice(index, 1);
						}
					});
					//console.log(value.weight);
				}
			});
			
			//Mise a jour de l'idServer pour l'element deplacé (sinon effet de bord non maitrise)
			draggedElement.attr("serverId", idDroppedServer);
			$scope.$apply();
		};

		// Partie pour gérer le drag and drop des regions
		$scope.dropped = function(dragEl, dropEl) {
			//console.log('fonction dropped');
			var drop = angular.element(dropEl);
			var drag = angular.element(dragEl);
			
			console.log("The element " + drag.attr('id') + " has been dropped on " + drop.attr("id") + "!");
			if( (drop.attr("serverId") != drag.attr("serverId")) && (drag.hasClass("shard") )){
				if(drop.hasClass("shards")){
					modifyServer(drop.attr("serverId"),drag);
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
        $scope.weightBalanceWarningType = function(weight, serverId) {
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
        }
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
        	if($scope.firstLoop){
        		$scope.firstLoop = false;
        	} else {
        		$scope.$apply();
        	}
        };

		$scope.sayHello = function(){
			$scope.greeting = 'Hello';
		};     
	}
);


 