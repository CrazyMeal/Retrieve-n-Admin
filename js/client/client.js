jQuery.event.props.push('dataTransfer');
var app = angular.module('MonApp',['lvl.directives.dragdrop','ui.bootstrap']);

app.factory('NetFactory', function($http, $q){
	var factory = {
		getServerDatas : function(){
			var deferred = $q.defer();
			$http({method: 'GET', url: 'tmp/FormeJsonCluster.json'})
				.success(function(data, status){
					factory.dataServer = data;
					deferred.resolve(factory.dataServer);
				})
				.error(function(data, status, headers, config){
					deferred.reject('Impossible de recuperer les datas');
				});
			return deferred.promise;
		}
	};
	return factory;
});

app.controller('MainController',function ($scope, NetFactory){
		
		//Partie pour récupération de données depuis le web
		$scope.datas = NetFactory.getServerDatas().then(function(dataServer){
			$scope.dataServer = dataServer;
			$scope.serversToSplit = [];
			//splitServers();
			var totalWeight = 0;
			
			angular.forEach($scope.dataServer.servers, function(server, index){
				var tmpWeightValue = 0;
				angular.forEach(server.shards, function(shard, index){
					tmpWeightValue = tmpWeightValue + parseInt(shard.weight);
				});
				server.weight = tmpWeightValue;
				totalWeight = totalWeight + parseInt(tmpWeightValue);
			});
			$scope.totalWeight = totalWeight;
		}, function(msg){
			alert(msg);
		});

		modifyServer = function(idDroppedServer, draggedElement){
			
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

		// Partie pour gérer le drag and drop
		$scope.dropped = function(dragEl, dropEl) {
			var drop = angular.element(dropEl);
			var drag = angular.element(dragEl);
			
			console.log("The element " + drag.attr('id') + " has been dropped on " + drop.attr("id") + "!");
			if( (drop.attr("serverId") != drag.attr("serverId")) && (drag.hasClass("shard") )){
				if(drop.hasClass("shards")){

					modifyServer(drop.attr("serverId"),drag);

					var newLightnessValue = 100 - (drag.attr("weight") * 45 / drop.attr("serverWeight"));
				} else {
					drop.replaceWith(drag);
				}
			}
		};

		$scope.droppedServer = function(dragEl, dropEl) {
			var drop = angular.element(dropEl);
			var drag = angular.element(dragEl);
			angular.forEach($scope.dataServer.servers, function(server, index){
				if(server.id == drag.attr('serverId')){
					if($.inArray(server, $scope.serversToSplit) == -1){
						$scope.serversToSplit.push(server);
					}
				}
			});
			splitServers();
			$scope.$apply();
		};

        $scope.weightPercent = function(weight, sWeight) {
        	var percentValue = 0;
        	var shardWeight = parseInt(weight);
        	var serverWeight = parseInt(sWeight);

        	percentValue = (shardWeight * 100) / serverWeight;
        	$scope.weightWarningType(weight, sWeight);
        	return percentValue;
        };
        

        $scope.weightWarningType = function(weight, sWeight) {
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
        $scope.serverWeight = function(serverWeight) {
			var tmpTotalWeight = 0;
			angular.forEach($scope.dataServer.servers, function(server, index){
				tmpTotalWeight = tmpTotalWeight + parseInt(server.weight);
			});
			var percentValue = 100 - (serverWeight * 60 / tmpTotalWeight);
        	return {  
        		'background-color': 'hsl(2, 100%,'+percentValue+'%)'
        	};
        };

        splitServers = function(){
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
	}
);
/*
app.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
 }]);
 */