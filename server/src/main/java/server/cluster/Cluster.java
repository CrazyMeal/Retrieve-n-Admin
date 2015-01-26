package server.cluster;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public class Cluster {
	
	private final Set<Server> servers = new HashSet<Server>();
	
	private transient boolean dirty = true;
	private transient double totalWeight;
	private transient double avgWeight;
	private transient Server mostLoadedServer;
	private transient Server lessLoadedServer;
	private transient Set<Shard> shards;
	private transient Shard heavierShard;
	private transient double worstImbalance;
	
	void addServer(Server server) {
		if (this != server.getCluster()) {
			throw new IllegalArgumentException("Adding server " + server + " to bad cluster");
		}
			
		this.servers.add(server);
	}

	public Set<Server> getServers() {
		return Collections.unmodifiableSet(servers);
	}

	synchronized void setDirty() {
		this.dirty = true;
	}
	
	protected synchronized boolean isDirty() {
		return this.dirty;
	}
	
	void computeStatsIfNecessary() {
		if (this.isDirty()) {
			this.computeStats();
		}
	}
	
	protected synchronized void computeStats() {
		shards = new HashSet<Shard>();
		this.totalWeight = 0;
		this.avgWeight = 0;
		this.mostLoadedServer = null;
		this.lessLoadedServer = null;
		this.shards.clear();
		this.heavierShard = null;
		this.worstImbalance = 0;
		
		for (Server server : this.servers) {
			double serverWeight = 0;
			for (Shard shard : server.getShards()) {
				boolean added = this.shards.add(shard);
				assert added : "Shard " + shard + " seems to be on different servers or included more the once";
				
				double weight = shard.getWeight();
				this.totalWeight += weight;
				serverWeight += weight;
				if (this.heavierShard == null || this.heavierShard.getWeight() < weight) {
					this.heavierShard = shard;
				}
			}
			
			server.setWeight(serverWeight);
			if (this.mostLoadedServer == null || this.mostLoadedServer.getWeightDirty() < serverWeight) {
				this.mostLoadedServer = server;
			}
			if (this.lessLoadedServer == null || this.lessLoadedServer.getWeightDirty() > serverWeight) {
				this.lessLoadedServer = server;
			}
		}
		
		this.avgWeight = this.servers.isEmpty() ? 0 : this.totalWeight/((double)this.servers.size());
		
		for (Server server : this.servers) {
			double serverWeight = server.getWeightDirty();
			double serverImbalance = serverWeight-this.avgWeight;
			server.setImbalance(serverImbalance);
			if (this.worstImbalance < serverImbalance) {
				this.worstImbalance = serverImbalance;
			}
		}
		
		this.dirty = false;
	}

	public double getTotalWeight() {
		this.computeStatsIfNecessary();
		return totalWeight;
	}

	public double getAvgWeight() {
		this.computeStatsIfNecessary();
		return avgWeight;
	}

	public Server getMostLoadedServer() {
		this.computeStatsIfNecessary();
		return mostLoadedServer;
	}

	public Server getLessLoadedServer() {
		this.computeStatsIfNecessary();
		return lessLoadedServer;
	}

	public Set<Shard> getShards() {
		this.computeStatsIfNecessary();
		return shards;
	}

	public Shard getHeavierShard() {
		this.computeStatsIfNecessary();
		return heavierShard;
	}

	public double getWorstImbalance() {
		this.computeStatsIfNecessary();
		return worstImbalance;
	}
	
}
