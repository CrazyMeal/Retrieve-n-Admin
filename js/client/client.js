jQuery.event.props.push('dataTransfer');
var app = angular.module('MonApp',['lvl.directives.dragdrop']);

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
			/*
			angular.forEach($scope.dataServer.servers, function(server, index){
				var tmpWeightValue = 0;
				angular.forEach(server.shards, function(shard, index){
					tmpWeightValue += parseInt(shard.weight);
				});
				server.weight = tmpWeightValue;
			});
			*/
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
					//console.log('Destination');
					//console.log(value);
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
					//console.log('Origin');
					//console.log(value);
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
			if(drop.attr("serverId") != drag.attr("serverId")){
				if(drop.hasClass("shards")){

					modifyServer(drop.attr("serverId"),drag);

					var newLightnessValue = 100 - (drag.attr("weight") * 60 / drop.attr("serverWeight"));
					drag.css({'background-color' : 'hsl(0, 100%,'+newLightnessValue+'%)' });
					
					//drop.append(drag);
				} else {
					drop.replaceWith(drag);
				}
			}
		};
		
		// Fonction pour la couleur p/r au poid
		$scope.shardWeight = function(value, serverValue) {
			var percentValue = 100 - (value * 60 / serverValue);
        	return { 
        		'padding-bottom': value+'px', 
        		'background-color': 'hsl(2, 100%,'+percentValue+'%)'
        	};
        }
	}
);

app.controller('SliderController',function ($scope, NetFactory){
		
		//Partie pour récupération de données depuis le web
		$scope.datas = NetFactory.getServerDatas().then(function(dataServer){
			$scope.dataServer = dataServer;
		}, function(msg){
			alert(msg);
		});
});
/*
app.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
 }]);
 */