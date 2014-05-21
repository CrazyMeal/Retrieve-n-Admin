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
			httpBackend.when('GET', 'tmp/FormeJsonCluster.json').respond(datas);

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
})