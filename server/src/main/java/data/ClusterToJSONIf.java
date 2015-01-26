package data;


import server.cluster.RegionsStat;

/**
 * @author Denaux Robin
 */
public interface ClusterToJSONIf {
    public String clusterAsJSON() throws Exception;
    public boolean checkTopologyEquals(RegionsStat lhs, RegionsStat rhs);
    public long getHoursToConsider();
    public void setHoursToConsider(long hoursToConsider);
}
