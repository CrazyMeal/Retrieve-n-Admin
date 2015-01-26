package server.cluster;

import com.googlecode.n_orm.ImplicitActivation;
import com.googlecode.n_orm.Key;
import com.googlecode.n_orm.Persisting;
import com.googlecode.n_orm.cf.MapColumnFamily;

import java.util.Date;
import java.util.Map;

@Persisting
public class RegionsStat {
	private static final long serialVersionUID = -4721478899214543494L;

	public static class Load {
		@Key(order=1) private String server;
		@Key(order=2) private long reads;
		@Key(order=3) private long writes;
		
		public Load() {}
		
		public Load(String server, long reads, long writes) {
			this.server = server;
			this.reads = reads;
			this.writes = writes;
		}
		public String getServer() {
			return server;
		}

		public void setServer(String server) {
			this.server = server;
		}

		public long getReads() {
			return reads;
		}
		public void setReads(long reads) {
			this.reads = reads;
		}
		public long getWrites() {
			return writes;
		}
		public void setWrites(long writes) {
			this.writes = writes;
		}
		public long getOperations() {
			return this.getReads()+this.getWrites();
		}
	}
	
	@Key(reverted=true) private Date timestamp;
	
	@ImplicitActivation private MapColumnFamily<String /* region name */, Load> load = new MapColumnFamily<String, Load>();
	
	public RegionsStat() {}
	
	public RegionsStat(Date timestamp) {
		this.timestamp = timestamp;
	}

	public Date getTimestamp() {
		return timestamp;
	}

	public void setTimestamp(Date timestamp) {
		this.timestamp = timestamp;
	}
	
	public boolean hasLoad(String region) {
		if (this.load.isActivated()) {
			return this.load.containsKey(region);
		} else {
			return this.load.getFromStore(region) != null;
		}
	}
	
	public Load getLoad(String region) {
		return this.load.get(region);
	}
	
	public void addLoad(String server, String region, long reads, long writes) {
		this.load.put(region, new Load(server, reads, writes));
	}
	
	public Map<String, Load> getLoad() {
		return this.load;
	}
}
