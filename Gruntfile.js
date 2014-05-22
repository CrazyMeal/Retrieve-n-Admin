module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    
    'http-server': {

        'dev': {

            // the server root directory
            root: './',

            port: 9000,
            // port: function() { return 8282; }

            host: "127.0.0.1",

            cache: 10,
            showDir : true,
            autoIndex: true,
            defaultExt: "html",

            // run in parallel with other tasks
            runInBackground: false
        }

    }
  });

  grunt.loadNpmTasks('grunt-http-server');
};