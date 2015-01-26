package data;

import org.apache.hadoop.hbase.ClusterStatus;
import org.apache.hadoop.hbase.ServerName;
import server.cluster.RegionsStat;

import java.io.IOException;

/**
 * @author Denaux Robin
 */
public interface RegionsStatsGrabberIf {
    public RegionsStat createLoadData(ClusterStatus clusterStatus);
    public void grabData() throws IOException;
    public void run();
    public void start();
    public String serverToString(ServerName server);
    public String regionToString(byte[] regionName);
}
