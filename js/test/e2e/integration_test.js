'use strict';

describe('homepage', function() {
	var ptor = protractor.getInstance();

	describe('test', function() {
		//ptor.driver.get('C:/Users/KVN/Documents/Projet2A-2014/JSBase/index.html');
		//ptor.driver.get('../index.html');
		//browser.driver.get('C:/Users/KVN/Documents/Projet2A-2014/JSBase/index.html');
		browser.get('index.html');
		browser.wait();
		console.log('le log: ');
		//expect(ptor.getTitle()).toBe('JSBase');
	});
});