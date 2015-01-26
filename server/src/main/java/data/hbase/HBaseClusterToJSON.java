package data.hbase;

import com.googlecode.n_orm.PersistingElement;
import com.googlecode.n_orm.StorageManagement;
import com.googlecode.n_orm.StoreSelector;
import com.googlecode.n_orm.hbase.Store;
import data.ClusterToJSONIf;
import org.apache.hadoop.hbase.ClusterStatus;
import org.apache.hadoop.hbase.HRegionInfo;
import org.apache.hadoop.hbase.HTableDescriptor;
import org.apache.hadoop.hbase.ServerName;
import org.apache.hadoop.hbase.client.HBaseAdmin;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import server.Main;
import server.cluster.*;
import server.cluster.RegionsStat.Load;
import server.exception.RegionInTransitionException;

import java.io.IOException;
import java.util.*;

/**
 * Offer method to create a JSON String which describe the Load on the Cluster
 */
public class HBaseClusterToJSON implements ClusterToJSONIf{

    private Store hstore;
    private long minSecondesToConsider;
    private long secondesToConsider;
    private String msgGrabData;
    private boolean success;

    /**
     * use param "minHoursToConsider" and "hoursToConsider" of the config file to know which RegionsStat to look for
     */
    public HBaseClusterToJSON() {
        hstore = (Store) StoreSelector.getInstance().getActualStoreFor(RegionsStat.class.asSubclass(PersistingElement.class));
        minSecondesToConsider = (Long)Main.config.get("minSecondesToConsider");
        secondesToConsider = (Long)Main.config.get("secondesToConsider");
    }

    /**
     * Compare actual RegionsStat to stored ones to know the load of every regions, and create a JSON object with theses data.
     * It can fail for various reasons :
     * A region can be in transition
     * The cluster disposition as changed, so there is no old RegionsStat
     * @return a valid JSON String
     * @throws RegionInTransitionException
     * @throws IOException
     */
    public String clusterAsJSON() throws IOException {
        success = true;

        // Checking that no region is in transition
        ClusterStatus clusterStatus = hstore.getAdmin().getClusterStatus();
        if (!clusterStatus.getRegionsInTransition().isEmpty()) {
            msgGrabData = "There are "+clusterStatus.getRegionsInTransition().size()+" regions in transition";
            success = false;
        }

        NavigableSet<RegionsStat> rss = null;
        if(success) {
            Date periodStart, periodEnd = new Date();
            periodStart = new Date(System.currentTimeMillis() - (int) (double) (secondesToConsider * 1000));
            //get every RegionsStat stored for the given time interval
            rss = StorageManagement
                    .findElements().ofClass(RegionsStat.class)
                    .withKey("timestamp").between(periodEnd).and(periodStart)
                    .withAtMost(1000).elements()
                    .andActivate().go();
            if (rss.isEmpty()) {
                System.err.println("No regionserver stats recorded ; giving up balancing");
                msgGrabData = "Waiting for new statistics";
                success = false;
            } else if (rss.size() == 1) {
                System.err.println("Only one regionserver stats recorded ; giving up balancing");
                msgGrabData = "Waiting for more statistics";
                success = false;
            }
        }

        RegionsStat lastRs = null, firstRs = null;
        if(success) {
            lastRs = Main.regionStatsGrabber.createLoadData(clusterStatus);

            // Finding first metrics with these regions
            for (Iterator<RegionsStat> it = rss.descendingIterator(); it.hasNext() && firstRs == null; ) {
                RegionsStat rs = it.next();
                if (checkTopologyEquals(lastRs, rs)) {
                    firstRs = rs;
                }
            }
            if (firstRs == null) {
                System.err.println("Topology changed ; cannot balance.");
                msgGrabData = "Topology has changed";
                try {
                    Main.regionStatsGrabber.grabData();
                } catch (IOException e) {
                    System.err.println("Cannot grab per-region load " + e);
                }
                success = false;
            }
        }

        long timePeriod = 0;
        if(success) {
            timePeriod = lastRs.getTimestamp().getTime() - firstRs.getTimestamp().getTime();
            assert timePeriod > 0;
            if (timePeriod < this.minSecondesToConsider * 1000) {
                System.err.println("Regions too young (metrics available for " + DateUtil.formatDuration(timePeriod) + " while expecting at least " + this.minSecondesToConsider + " secondes) ; cannot balance.");
                msgGrabData = "Statistics are too young, wait " + DateUtil.formatDuration((long)(this.minSecondesToConsider*1000)-Math.round(timePeriod/1000)*1000);
                success = false;
            }
        }

        Cluster cluster = null;
        Map<HRegionInfo, String> regionsInfos = null;
        if(success) {
            // Describing topology
            double timePeriodInH = timePeriod / (60 * 60 * 1000);
            cluster = new Cluster();
            Map<String, Server> servers = new HashMap<String, Server>();
            for (ServerName server : clusterStatus.getServers())
                if (clusterStatus.getLoad(server).getNumberOfRegions() == 0)
                    servers.put(server.getHostAndPort(), new Server(cluster, server.getHostAndPort()));
            for (Map.Entry<String, Load> load : lastRs.getLoad().entrySet()) {
                String serverName = load.getValue().getServer();
                Server server = servers.get(serverName);
                if (server == null) {
                    server = new Server(cluster, serverName);
                    servers.put(serverName, server);
                }

                String regionName = load.getKey();

                long lastOps = load.getValue().getOperations();
                long firstOps = firstRs.getLoad(regionName).getOperations();
                assert lastOps >= firstOps;
                double rph = ((double) lastOps - firstOps) / timePeriodInH;

                new Shard(server, regionName, rph);
            }

            //we make a map holding regions/tables link.
            HBaseAdmin admin = hstore.getAdmin();
            regionsInfos = new HashMap<HRegionInfo, String>();
            HTableDescriptor[] tables = admin.listTables();
            for(HTableDescriptor table : tables) {
                for(HRegionInfo reginfo : admin.getTableRegions(table.getName()))
                    regionsInfos.put(reginfo, table.getNameAsString());
            }
        }

        if(success){
            Date now = new Date();
            if(now.getTime()-Main.timeAtApply.getTime()<6000){
                msgGrabData = "Waiting for the server";
                success = false;
            }
        }

        //creating the JSON Object
        JSONObject jsonServers = new JSONObject();
        JSONArray serversArray = new JSONArray();

        if(success) {
            for (Server server : cluster.getServers()) {
                JSONObject jsonServer = new JSONObject();
                jsonServer.put("id", JSONValue.escape(server.getId()));
                JSONArray serverShards = new JSONArray();
                serversArray.add(jsonServer);

                List<Shard> sortedShards = new ArrayList<Shard>(server.getShards());
                Collections.sort(sortedShards, new Comparator<Shard>() {
                    @Override
                    public int compare(Shard o1, Shard o2) {
                        return (int) (1000 * (o2.getWeight() - o1.getWeight()));
                    }
                });

                for (Shard shard : sortedShards) {
                    JSONObject jsonShard = new JSONObject();
                    jsonShard.put("id", JSONValue.escape(shard.getId()));
                    jsonShard.put("weight", Main.DEBUG ? (Math.random() * 50) : shard.getWeight());


                    for (Map.Entry<HRegionInfo, String> info : regionsInfos.entrySet())
                        if (JSONValue.escape(info.getKey().getRegionNameAsString()).equals(JSONValue.escape(shard.getId()).replace("\\u000", "\\\\x0"))) {
                            jsonShard.put("table", info.getValue());
                            break;
                        }

                    if (jsonShard.containsKey("table"))
                        serverShards.add(jsonShard);

                }
                jsonServer.put("shards", serverShards);
            }
            jsonServers.put("servers", serversArray);
        }
        else {
            jsonServers.put("error", msgGrabData);
        }
        return jsonServers.toJSONString();
    }

    /**
     * compare two RegionsStat to see if the topology as changed
     * @param lhs
     * @param rhs
     * @return are the two topology equals?
     */
    public boolean checkTopologyEquals(RegionsStat lhs, RegionsStat rhs) {
        // Same regions
        if (!lhs.getLoad().keySet().equals(rhs.getLoad().keySet())) {
            return false;
        }

        // Same server for each region
        for (Map.Entry<String, Load> lhsLoad : lhs.getLoad().entrySet()) {
            String region = lhsLoad.getKey();
            Load rhsLoad = rhs.getLoad(region);
            assert rhsLoad != null; // checked above
            String lshServer = lhsLoad.getValue().getServer();
            String rhsServer = rhsLoad == null ? null : rhsLoad.getServer();
            if (rhsServer == null || !rhsServer.equals(lshServer)) {
                return false;
            }
        }

        return true;
    }

    //used to test this class
    public Store getHstore() {
        return hstore;
    }
    public void setHstore(Store hstore) {
        this.hstore = hstore;
    }

    public long getHoursToConsider() {
        return this.secondesToConsider;
    }

    public void setHoursToConsider(long secondesToConsider) {
        if (secondesToConsider <= 1) {
            throw new IllegalArgumentException(secondesToConsider + " should be > 1");
        }
        if (secondesToConsider <= minSecondesToConsider) {
            this.minSecondesToConsider = secondesToConsider-1;
        }
        this.secondesToConsider = secondesToConsider;
    }
}
