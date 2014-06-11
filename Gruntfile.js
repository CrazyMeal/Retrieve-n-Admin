module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    
    'http-server': {

        'dev': {

            // the server root directory
            root: './',

            port: 9000,

            host: "127.0.0.1",

            cache: 10,
            showDir : true,
            autoIndex: true,
            defaultExt: "html",

            // run in parallel with other tasks
            runInBackground: false
        }
    },
    'karma' : {
      'unit' : {
        configFile: 'karma.conf.js'
      }
    }
  });
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-http-server');
};