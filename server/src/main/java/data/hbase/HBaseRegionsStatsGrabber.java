package data.hbase;

import com.googlecode.n_orm.PersistingElement;
import com.googlecode.n_orm.StoreSelector;
import com.googlecode.n_orm.cache.perthread.Cache;
import com.googlecode.n_orm.hbase.Store;

import data.BackgroundJob;
import data.RegionsStatsGrabberIf;

import org.apache.hadoop.hbase.ClusterStatus;
import org.apache.hadoop.hbase.HServerLoad;
import org.apache.hadoop.hbase.ServerName;
import org.apache.hadoop.hbase.util.Bytes;

import server.Main;
import server.cluster.DateUtil;
import server.cluster.RegionsStat;

import java.io.IOException;
import java.util.Date;
import java.util.Map;
import java.util.logging.Level;

/**
 * offer method to create stats of the database and to store them.
 */
public class HBaseRegionsStatsGrabber extends BackgroundJob implements RegionsStatsGrabberIf {

    @SuppressWarnings("unchecked")
    private static Store s = (Store) StoreSelector.getInstance().getActualStoreFor(
            (Class<? extends PersistingElement>) RegionsStat.class);
    /**
     * analyse the ClusterStatus to create a RegionStats
     * @param clusterStatus
     * @return
     */
    public RegionsStat createLoadData(ClusterStatus clusterStatus) {
        RegionsStat regionsStats = new RegionsStat(new Date());
        for (ServerName server : clusterStatus.getServers()) {
            for (Map.Entry<byte[], HServerLoad.RegionLoad> regionLoad : clusterStatus.getLoad(server).getRegionsLoad().entrySet()) {
                regionsStats.addLoad(serverToString(server), regionToString(regionLoad.getKey()), regionLoad.getValue().getReadRequestsCount(), regionLoad.getValue().getWriteRequestsCount());
            }
        }
        return regionsStats;
    }

    public String regionToString(byte[] regionName) {
        return Bytes.toString(regionName);
    }

    public String serverToString(ServerName server) {
        return server.getHostname() + ':' + server.getPort();
    }

    /**
     * get the ClusterStatus, call createLoadData() and save the stats on the database
     * @throws IOException
     */
    public void grabData() throws IOException {
        ClusterStatus clusterStatus = s.getAdmin().getClusterStatus();
        RegionsStat regionsStats = createLoadData(clusterStatus);

        System.out.println("Statistics grabbed from the base on "+ DateUtil.getDay(new Date()));
        regionsStats.store();
    }

    /**
     * used by BackgroundJob to call grabData regularly
     */
    @Override
    public void run() {
        do {
            try {
                grabData();
            } catch (IOException e) {
                getLogger().log(Level.WARNING, "Cannot grab per-region load", e);
            }
            Cache.getCache().reset();
        } while (this.shouldContinue(((Long)Main.config.get("timeBtwStatsGrab"))*1000));
    }
}
