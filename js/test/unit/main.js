'use strict';

describe('Unit: Maincontroller', function() {
	beforeEach(angular.mock.module('MonApp'));
	var ctrl, scope, httpBackend;
	var datas = {
	    "cluster": 0,
	    "worstImbalance": "60",
	    "servers": [
	        {
	            "id": 0,
	            "shards": [
	                {
	                    "id": "s0s0",
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
    ]};
	beforeEach(
		angular.mock.inject(function($controller, $rootScope, $injector){
			scope = $rootScope.$new();
			httpBackend = $injector.get('$httpBackend');
			httpBackend.when('GET', 'testDatas/FormeJsonCluster.json').respond(datas);

			ctrl = $controller('MainController', { $scope: scope });
			scope.$digest();
			httpBackend.flush();


		})
	);
	
	afterEach(function() {
         httpBackend.verifyNoOutstandingExpectation();
         httpBackend.verifyNoOutstandingRequest();
    });

	it('Hello world test',
		function() {
			expect(scope.greeting).toBeUndefined();
			scope.sayHello();
			expect(scope.greeting).toEqual('Hello');
		}
	);

	it('Initial values',
		function(){
			expect(scope.worstImbalance).toEqual('49.1667');
			expect(scope.average).toEqual('57.8333');
			//expect(scope.totalWeight).toEqual(347);
		}
	);

	it('WeightPercent function',
		function(){
			expect(scope.weightPercent(scope.dataServer.servers[0].shards[0].weight,scope.dataServer.servers[0].weight)).toEqual(12.5);
		}
	);

	it('WeightWarningType function',
		function() {
			var shardWeight = scope.dataServer.servers[0].shards[0].weight;
			var serverWeight = scope.dataServer.servers[0].weight;
			var returnedValue = scope.weightWarningType(shardWeight, serverWeight);

			expect(returnedValue).toEqual('success');

			shardWeight = scope.dataServer.servers[0].shards[1].weight;
			returnedValue = scope.weightWarningType(shardWeight, serverWeight);
			expect(returnedValue).toEqual('info');

			shardWeight = scope.dataServer.servers[0].shards[2].weight;
			returnedValue = scope.weightWarningType(shardWeight, serverWeight);
			expect(returnedValue).toEqual('warning');
		}
	);

	it('WeightBalanceWarningType', 
		function () {
			var serverWeight = scope.dataServer.servers[0].weight;
			var returnedValue = scope.weightBalanceWarningType(serverWeight);

			expect(returnedValue).toEqual('info');

			serverWeight = scope.dataServer.servers[1].weight;
			returnedValue = scope.weightBalanceWarningType(serverWeight);
			expect(returnedValue).toEqual('success');

			serverWeight = scope.dataServer.servers[2].weight;
			returnedValue = scope.weightBalanceWarningType(serverWeight);
			expect(returnedValue).toEqual('danger');
		}
	);

	it('Calculate Imbalance function',
		function() {
			var serverWeight = scope.dataServer.servers[0].weight;
			var returnedValue = calculateImbalance(serverWeight);

			expect(returnedValue).toEqual(22.1667);
		}
	);
})