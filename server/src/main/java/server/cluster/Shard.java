package server.cluster;

public class Shard {

	private final Server originalServer;
	private Server server;
	private final String id;
	private final double weight;

	public Shard(Server server, String id, double weight) {
		if (weight < 0) {
			throw new IllegalArgumentException("Weight for shard " + id + " should not be nagative (here " + weight + ')');
		}
		this.originalServer = server;
		this.server = server;
		this.id = id;
		this.weight = weight;
		this.server.addShard(this);
	}

	public Server getServer() {
		return server;
	}

	public void setServer(Server server) {
		if (this.server == server) {
			return;
		}
		
		if (this.server.getCluster() != server.getCluster()) {
			throw new IllegalArgumentException("Cannot move a shard from cluster " + this.server.getCluster() + " to " + server.getCluster());
		}
		
		this.server.getCluster().setDirty();
		
		this.server.removeShard(this);
		this.server = server;
		this.server.addShard(this);
	}

	public Server getOriginalServer() {
		return originalServer;
	}

	public String getId() {
		return id;
	}

	public double getWeight() {
		return weight;
	}

	@Override
	public String toString() {
		return "Shard " + this.getId();
	}

}
