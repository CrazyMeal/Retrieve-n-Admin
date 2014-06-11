'use strict';

describe('homepage', function() {
	beforeEach(function () {
    // Load up a view and wait for it to be done with its rendering and epicycles.
	    browser.get('index.html');
	    browser.waitForAngular();
	    browser.sleep(1500);
	});
	
	it('Title test',
		function() {
			expect(browser.getTitle()).toBe('Retrieve\'n Admin');
			console.log(' \n Title test passed');
		}
	);

	it('Init test',
		function() {
			var elems = element.all(by.repeater('server in dataServer.servers'));
			expect(elems.count()).toBe(6);

			elems = element.all(by.repeater('chunkServer in splitServers'));
			expect(elems.count()).toBe(1);
			console.log('Init test passed');
		}
	);

	it('Drag and drop test',
		function() {
			//element(by.css('button[serverId="300"]')).click();
			
			//browser.actions().click(element(by.css('li[serverId="1"]'))).perform();
			//browser.actions().click(element(by.css('#serverContainer'))).perform();
			/*
			browser.actions().dragAndDrop(
				element(by.css('li[serverId="1"]')).find(),
				element(by.css('#serverContainer')).find()
			).perform();
			browser.sleep(1500);
			*/
			/*
			browser.actions().
			   mouseMove(element(by.css('li[serverId="1"]'))).
			   mouseDown().
			   mouseMove(element(by.css('#serverContainer'))). // [] optional
			   mouseUp().
			   perform();
			  */
			  /*
			browser.actions().mouseMove(element(by.css('li[serverId="1"]'))).perform();
			browser.actions().mouseDown().perform();
			browser.actions().mouseMove(element(by.css('#serverContainer')),{x: 50, y:50}).perform();
			browser.actions().mouseUp().perform();
			browser.sleep(1500);
			*/
			/*
			var list = element.all(by.css('#serversSlider ul li'));
			var serverToDrag = element.all(by.css('#serversSlider ul li')).get(0);

			serverToDrag.getText().then(function(dat){
				expect(dat).toBe('id: 3\nweight: 107');
			});
			
			var dropZone = element(by.css('#serverContainer'));

			browser.actions().dragAndDrop(
				element.all(by.css('#serversSlider ul li')).get(0),
				element(by.css('#serverContainer'))
			).perform();
			browser.sleep(1500);
			console.log('Drag and drop test passed');
			*/
		}
	);
});