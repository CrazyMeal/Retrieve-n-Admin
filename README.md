Retrieve-n-Admin
================

Javascript to manipulate HBase regions.

This project was made by Denaux Robin and Paquet Kévin and managed by Fondement Frédéric

Installation
================
Before any command, note that you have to have [Node.js](http://nodejs.org/) installed on your computer.

All dependecies you need are specified in the project, you just need this command to setup:

    npm install

> Notice that this project alone will only work on local datas, you need to get Server side to have a fully interactive project

Run Unit tests
================
To run Unit Tests run:

    grunt karma

And enjoy your passing tests :)

E2E tests (Integration Tests)
================
To run e2e tests you have to first install standalone selenium webdriver with:

    node ./node_modules/protractor/bin/webdriver-manager update

Then start an http server to make your site avaible on localhost

    grunt http-server:dev

Start the selenium webdriver

    node ./node_modules/protractor/bin/webdriver-manager start

And finally you can run your e2e tests