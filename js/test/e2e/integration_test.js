'use strict';

describe('homepage', function() {
	beforeEach(function () {
    // Load up a view and wait for it to be done with its rendering and epicycles.
	    browser.get('index.html');
	    browser.waitForAngular();
	});
	
	it('Title test',
		function() {
			expect(browser.getTitle()).toBe('JSBase');
			console.log(' \n Title test passed');
		}
	);

	it('Init test',
		function() {
			var elems = element.all(by.repeater('server in dataServer.servers'));
			expect(elems.count()).toBe(6);

			elems = element.all(by.repeater('chunkServer in splitServers'));
			expect(elems.count()).toBe(0);
			console.log('Init test passed');
		}
	);

	it('Drag and drop test',
		function() {
			element.all(by.css('#serversSlider ul li')).get(0).getText().then(function(dat){
				console.log(dat);
				expect(dat).toBe('id: 3\nweight: 107');
			});
		}
	);
});