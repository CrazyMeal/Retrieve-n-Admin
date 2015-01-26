About the project :

This is a web interface to manage the repartition of regions on a distributed database.
It run only with hbase so far, but the structure allow you to create new classes for other databases.


Building the server :

Run the maven goal 'package', it will create two .jar on the target folder.
Add the app folder next to the jar, it contains the client apps to distribute.
RetrieveAndAdminServer-*-jar-with-dependencies.jar can be run to launch the server.