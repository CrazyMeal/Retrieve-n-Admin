package server;

import com.google.protobuf.ServiceException;
import com.googlecode.n_orm.PersistingElement;
import com.googlecode.n_orm.StoreSelector;
import com.googlecode.n_orm.hbase.Store;
import org.apache.hadoop.hbase.MasterNotRunningException;
import org.apache.hadoop.hbase.ZooKeeperConnectionException;
import server.cluster.RegionsStat;

/**
 * Offer method to start or stop the Hbase balancer.
 * This class is needed as we can call the admin from the Main class
 * @author Denaux Robin
 */
public class HBaseBalancerManager {

    private Store hstore;

    public HBaseBalancerManager(){
        hstore = (Store) StoreSelector.getInstance().getActualStoreFor(RegionsStat.class.asSubclass(PersistingElement.class));
    }

    public void stopBalancer(){
        try {
            hstore.getAdmin().setBalancerRunning(false, true);
        } catch (MasterNotRunningException e) {
            e.printStackTrace();
        } catch (ZooKeeperConnectionException e) {
            e.printStackTrace();
        }
    }

    public void startBalancer(){
        try {
            hstore.getAdmin().balancer();
            hstore.getAdmin().setBalancerRunning(true, true);
        } catch (MasterNotRunningException e) {
            e.printStackTrace();
        } catch (ZooKeeperConnectionException e) {
            e.printStackTrace();
        }
    }
}
