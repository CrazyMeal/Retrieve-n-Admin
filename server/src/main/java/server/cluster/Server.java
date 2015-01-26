package server.cluster;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public class Server {

	private final String id;
	private final Cluster cluster;
	private final Set<Shard> shards = new HashSet<Shard>();

	private transient double weight;
	private transient double imbalance;

	public Server(Cluster cluster, String id) {
		this.cluster = cluster;
		this.id = id;
		this.cluster.addServer(this);
	}

	public Cluster getCluster() {
		return this.cluster;
	}

	public String getId() {
		return id;
	}

	public void addShard(Shard shard) {
		boolean added = this.shards.add(shard);
		if (added) {
			this.getCluster().setDirty();
			shard.setServer(this);
		}
	}

	public void removeShard(Shard shard) {
		boolean removed = this.shards.remove(shard);
		if (removed) {
			this.getCluster().setDirty();
		}
		assert removed;
	}

	public boolean hasShard(Shard shard) {
		return this.shards.contains(shard);
	}

	public Set<Shard> getShards() {
		return Collections.unmodifiableSet(this.shards);
	}
	
	public double getWeight() {
		this.getCluster().computeStatsIfNecessary();
		return this.weight;
	}

	void setWeight(double weight) {
		this.weight = weight;
	}
	
	double getWeightDirty() {
		return this.weight;
	}
	
	public double getImbalance() {
		this.getCluster().computeStatsIfNecessary();
		return this.imbalance;
	}

	void setImbalance(double imbalance) {
		this.imbalance = imbalance;
	}

	@Override
	public String toString() {
		return "Server " + this.getId();
	}

}
