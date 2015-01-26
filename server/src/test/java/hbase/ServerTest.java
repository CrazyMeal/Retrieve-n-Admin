package hbase;
/*
import com.googlecode.n_orm.hbase.Store;
import data.hbase.HBaseClusterToJSON;
import data.hbase.HBaseRegionsStatsGrabber;
import move.hbase.HBaseRegionMover;
import org.apache.hadoop.hbase.ClusterStatus;
import org.apache.hadoop.hbase.RegionLoad;
import org.apache.hadoop.hbase.ServerLoad;
import org.apache.hadoop.hbase.ServerName;
import org.apache.hadoop.hbase.client.HBaseAdmin;
import org.apache.hadoop.hbase.master.RegionState;
import org.apache.hadoop.hbase.protobuf.generated.ClusterStatusProtos;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;
import server.HBaseBalancerManager;
import server.Main;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.*;

import static org.mockito.Mockito.*;
*/

/**
 * Created by robin on 16/05/14.
 * Don't work actually, tests cannot reach the server.
 */
public class ServerTest {
/*
    private static int port = 8080;
    private static Store storeMock = mock(Store.class);
    private static HBaseAdmin adminMock = mock(HBaseAdmin.class);
    private static String moves;
    private static Store store;
    private static Main server;
*//*
    @BeforeClass
    public static void launchServer() {
        try {
            Thread thread = new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Main.loadConfig();
                        server = new Main(new HBaseClusterToJSON(), new HBaseRegionMover(), new HBaseRegionsStatsGrabber(), new HBaseBalancerManager());
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
            thread.start();
        } catch (Exception e) {
            e.printStackTrace();
        }
        try {
            String hbaseVersion = "0.94.18";
            String clusterid = "clusterID";
            Map<ServerName, ServerLoad> servers = new HashMap<ServerName, ServerLoad>();
            Map<byte[], RegionLoad> regionLoad = new HashMap<byte[], RegionLoad>();
            //add here some server
            createRegion("region1", regionLoad);
            createServer("server1", servers, regionLoad);

            regionLoad = new HashMap<byte[], RegionLoad>();
            createRegion("region2", regionLoad);
            createRegion("region3", regionLoad);
            createServer("server2", servers, regionLoad);

            ServerName master = new ServerName("masterName", 80, 1l);
            Map<String, RegionState> rit = new HashMap<String, RegionState>();
            ClusterStatus cluster = new ClusterStatus(hbaseVersion, clusterid, servers,
                    new ArrayList<ServerName>(), master, new ArrayList<ServerName>(),
                    rit, new String[0], false);

            JSONArray m = new JSONArray();
            m.add(addMove("server1", "server2", "region"));
            moves = m.toJSONString();

            Thread.sleep(40000);

            when(storeMock.getAdmin()).thenReturn(adminMock);
            when(adminMock.getClusterStatus()).thenReturn(cluster);
            store = ((HBaseClusterToJSON) Main.clusterToJSON).getHstore();

            ((HBaseClusterToJSON) Main.clusterToJSON).setHstore(storeMock);


        } catch (Exception e) {
            e.printStackTrace();
        }
    }


    @Test
    public void aboutClusterTest() {
        URL url;
        try {
            url = new URL("http://127.0.0.1:" + port + "/aboutCluster");
            HttpURLConnection co = (HttpURLConnection) url.openConnection();
            co.setDoOutput(true);
            DataOutputStream wr = new DataOutputStream(
                    co.getOutputStream());
            wr.flush();
            wr.close();

            InputStream is = co.getInputStream();
            BufferedReader rd = new BufferedReader(new InputStreamReader(is));
            String line;
            StringBuilder response = new StringBuilder();
            while ((line = rd.readLine()) != null) {
                response.append(line);
                response.append('\r');
            }
            rd.close();

            System.out.println(response.toString());
            JSONObject cluster = (JSONObject) JSONValue.parse(response.toString());
            assert (cluster.get("servers") != null);
            assert true;

        } catch (MalformedURLException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }


    @Test
    public void grabDataTest() {
        URL url;
        try {
            url = new URL("http://127.0.0.1:" + port + "/grabData");
            HttpURLConnection co = (HttpURLConnection) url.openConnection();
            co.setDoOutput(true);
            DataOutputStream wr = new DataOutputStream(
                    co.getOutputStream());
            wr.flush();
            wr.close();

            InputStream is = co.getInputStream();
            BufferedReader rd = new BufferedReader(new InputStreamReader(is));
            String line;
            StringBuilder response = new StringBuilder();
            while ((line = rd.readLine()) != null) {
                response.append(line);
                response.append('\r');
            }
            rd.close();

            assert (response.toString().contains("done"));

        } catch (MalformedURLException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    @Test(expected = IOException.class)
    public void badRequestTest() throws IOException {
        URL url;
        try {
            url = new URL("http://127.0.0.1:" + port + "/xyz");
            HttpURLConnection co = (HttpURLConnection) url.openConnection();
            co.setDoOutput(true);
            DataOutputStream wr = new DataOutputStream(
                    co.getOutputStream());
            wr.flush();
            wr.close();

            InputStream is = co.getInputStream();
            BufferedReader rd = new BufferedReader(new InputStreamReader(is));
            String line;
            StringBuilder response = new StringBuilder();
            while ((line = rd.readLine()) != null) {
                response.append(line);
                response.append('\r');
            }
            rd.close();

            assert (response.toString().contains("Failure: 404 Not Found"));

        } catch (MalformedURLException e) {
            e.printStackTrace();
        }
    }

    @Test(expected = IOException.class)
    public void applyChangesTest() throws IOException {
        URL url;
        try {
            url = new URL("http://127.0.0.1:" + port + "/applyChanges");
            HttpURLConnection co = (HttpURLConnection) url.openConnection();
            co.setDoOutput(true);
            DataOutputStream wr = new DataOutputStream(
                    co.getOutputStream());
            wr.writeChars(moves);
            wr.flush();
            wr.close();

            InputStream is = co.getInputStream();
            BufferedReader rd = new BufferedReader(new InputStreamReader(is));
            String line;
            StringBuilder response = new StringBuilder();
            while ((line = rd.readLine()) != null) {
                response.append(line);
                response.append('\r');
            }
            rd.close();

            assert (response.toString().contains("done"));
            assert (!response.toString().contains("error"));

        } catch (MalformedURLException e) {
            e.printStackTrace();
        }
    }

    @AfterClass
    public static void stopServer() {
        ((HBaseClusterToJSON) Main.clusterToJSON).setHstore(store);
        server.stop();
    }

    public static void createRegion(String name, Map<byte[], RegionLoad> regionLoad) {
        regionLoad.put(name.getBytes(), new RegionLoad(ClusterStatusProtos.RegionLoad.getDefaultInstance()));
    }

    public static void createServer(String name, Map<ServerName, ServerLoad> servers, Map<byte[], RegionLoad> regionLoad) {
        Set<String> coprocesseur = new TreeSet<String>();
        coprocesseur.add("test");
        ServerLoad load = new ServerLoad(ClusterStatusProtos.ServerLoad.getDefaultInstance());
        servers.put(new ServerName(name, (int) (Math.random() * 50), 1l), load);
    }

    public static JSONObject addMove(String from, String to, String shard) {
        JSONObject o = new JSONObject();
        o.put("idOrigin", from);
        o.put("idDest", to);
        o.put("idShard", shard);
        return o;
    }

    public static boolean tryLaunch() {
        URL url;
        try {
            url = new URL("http://127.0.0.1:" + port + "/xyz");
            HttpURLConnection co = (HttpURLConnection) url.openConnection();
            co.setDoOutput(true);
            DataOutputStream wr = new DataOutputStream(
                    co.getOutputStream());
            wr.flush();
            wr.close();

            InputStream is = co.getInputStream();
            BufferedReader rd = new BufferedReader(new InputStreamReader(is));
            String line;
            StringBuilder response = new StringBuilder();
            while ((line = rd.readLine()) != null) {
                response.append(line);
                response.append('\r');
            }
            rd.close();
        } catch (MalformedURLException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }
        return true;
    }*/
}
