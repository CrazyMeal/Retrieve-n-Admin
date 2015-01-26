package move.hbase;

import com.googlecode.n_orm.PersistingElement;
import com.googlecode.n_orm.StoreSelector;
import com.googlecode.n_orm.hbase.Store;
import move.RegionMoverIf;
import org.apache.hadoop.hbase.HRegionInfo;
import org.apache.hadoop.hbase.HTableDescriptor;
import org.apache.hadoop.hbase.ServerName;
import org.apache.hadoop.hbase.client.HBaseAdmin;
import org.apache.hadoop.hbase.util.Bytes;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import server.Main;
import server.cluster.*;

import java.io.IOException;
import java.util.*;

/**
 * Parse JSON and apply Moves to the database
 */
public class HBaseRegionMover implements RegionMoverIf {

    private Store hstore = (Store) StoreSelector.getInstance().getActualStoreFor(RegionsStat.class.asSubclass(PersistingElement.class));

    /**
     * If the changes are instances of Moves, the admin is called to apply them
     * @param changes
     * @throws IOException
     * @throws InterruptedException
     */
    public void apply(Set<Change> changes) throws IOException, InterruptedException {

        if (changes == null || changes.isEmpty()) {
            return;
        }

        HBaseAdmin admin = hstore.getAdmin();
        Collection<ServerName> servers = admin.getClusterStatus().getServers();
        Map<String, HRegionInfo> regions = new HashMap<String, HRegionInfo>();
        for (HTableDescriptor table : admin.listTables()) {
            for (HRegionInfo region : admin.getTableRegions(table.getName())) {
                regions.put(JSONValue.escape(Main.regionStatsGrabber.regionToString(region.getRegionName())), region);
            }
        }
        Map<HRegionInfo, ServerName> movesToApply = new HashMap<HRegionInfo, ServerName>();

        for (Change change : changes) {
            if (! (change instanceof Move)) {
                System.err.println("Cannot treat recommendation " + change);
            }

            Move move =  (Move)change;
            // Looking for server
            ServerName server = null;
            for (ServerName serverName : servers) {
                if (move.getTo().getId().equals(serverName.getServerName())) {
                    server = serverName;
                    break;
                }
            }
            if (server == null) {
                System.err.println("Cannot find server " + move.getTo().getId());
            }
            // Looking for region
            HRegionInfo regionName = regions.get(move.getShard().getId().replace("\\x0", "\\u000"));
            if (regionName == null) {
                System.err.println("Cannot find region " + move.getShard().getId()+"\n"+regions.entrySet().toArray()[0]);
                StringBuilder sb = new StringBuilder();
                sb.append("Known regions are:");
                for (Map.Entry<String, HRegionInfo> kr : regions.entrySet()) {
                    sb.append('\n');
                    sb.append(kr.getKey());
                }
                System.out.println(sb.toString());
            }
            if(regionName!=null && server!=null)
                movesToApply.put(regionName, server);
        }

        // Actually applying changes
        for (Map.Entry<HRegionInfo, ServerName> change : movesToApply.entrySet()) {
            System.out.println("Moving region encoded " + change.getKey().getEncodedName() + " to " + change.getValue().getServerName());
            admin.move(change.getKey().getEncodedNameAsBytes(), Bytes.toBytes(change.getValue().getServerName()));
        }
        try {
            Main.regionStatsGrabber.grabData();
        } catch (IOException e) {
            System.err.println("Cannot grab per-region load"+ e);
        }
    }

    /**
     * From a JSON String holding all the changes wanted, create a list of java Moves and passe it to apply()
     * @param JSONOfChanges
     */
    public void computeChanges(String JSONOfChanges){
        Store hstore = (Store) StoreSelector.getInstance().getActualStoreFor(RegionsStat.class.asSubclass(PersistingElement.class));
        try {
            Set<Change> moves = new HashSet<Change>();

            if(JSONOfChanges.isEmpty())
                System.err.println("no data received");
            else {
                JSONObject m = (JSONObject) JSONValue.parse(JSONOfChanges);
                JSONArray movesArray = (JSONArray)m.get("moves");

                for (Object o : movesArray) {
                    //parsing the JSON
                    JSONObject moveReq = (JSONObject) o;
                    Server from = null, to = null;
                    Shard shard = null;
                    Cluster cluster = new Cluster();
                    String idShard = (String) moveReq.get("idShard");
                    String idDest = (String) moveReq.get("idDest");
                    String idFrom = (String) moveReq.get("idOrigin");

                    //trying to find corresponding Server objects
                    for (ServerName server : hstore.getAdmin().getClusterStatus().getServers()) {
                        if (idDest.equals(server.getHostAndPort()))
                            to = new Server(cluster, server.getServerName());
                        if (idFrom.equals(server.getHostAndPort()))
                            from = new Server(cluster, server.getServerName());

                    }

                    //trying to find corresponding Shard objects
                    for (HTableDescriptor table : hstore.getAdmin().listTables()) {
                        for (HRegionInfo region : hstore.getAdmin().getTableRegions(table.getName())) {
                            if (region.getRegionNameAsString().replace("\\x0", "\\u000").equals(idShard))
                                shard = new Shard(from, region.getRegionNameAsString(), 1.);
                        }
                    }

                    //do we have all object needed?
                    if (from != null && to != null && shard != null) {
                        Change move = new Move(shard, from, to);
                        moves.add(move);
                    } else {
                        System.err.println("error while moving "+idShard+" from "+idFrom+" to "+idDest);
                    }

                }

                apply(moves);
            }
        } catch (IOException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}
