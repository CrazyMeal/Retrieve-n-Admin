package hbase.mock;

import data.hbase.HBaseRegionsStatsGrabber;
import org.apache.hadoop.hbase.ClusterStatus;
import server.cluster.RegionsStat;

import java.util.Date;
import java.util.NavigableSet;
import java.util.TreeSet;

/**
 * Created by robin on 26/05/14.
 */
public class StorageManagementInnerMock {

    public static ClusterStatus cluster;

    public StorageManagementInnerMock ofClass(Class<RegionsStat> clazz){
        return this;
    }

    public StorageManagementInnerMock withKey(String key){
        return this;
    }

    public StorageManagementInnerMock between(Date date){
        return this;
    }

    public StorageManagementInnerMock and(String key){
        return this;
    }

    public StorageManagementInnerMock withAtMost(int nb){
        return this;
    }

    public StorageManagementInnerMock element(){
        return this;
    }

    public StorageManagementInnerMock andActivate(){
        return this;
    }

    public NavigableSet<RegionsStat> go(){
        NavigableSet<RegionsStat> result = new TreeSet<RegionsStat>();
        RegionsStat stat = new HBaseRegionsStatsGrabber().createLoadData(cluster);
        stat.setTimestamp(new Date(stat.getTimestamp().getTime()-60*60*1000));
        result.add(stat);
        return result;
    }


}
