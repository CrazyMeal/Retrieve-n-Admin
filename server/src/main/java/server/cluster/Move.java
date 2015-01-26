package server.cluster;

public class Move extends Change {
	private final Shard shard;
	private final Server from, to;
	
	public Move(Shard shard, Server from, Server to) {
		super();
		this.shard = shard;
		this.from = from;
		this.to = to;
	}

	public Shard getShard() {
		return shard;
	}

	public Server getFrom() {
		return from;
	}

	public Server getTo() {
		return to;
	}

	@Override
	public String toString() {
		return "Shard " + shard.getId() + " (weighted " + shard.getWeight() + ") should be moved from " + from + " to " + to;
	}

	@Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + ((from == null) ? 0 : from.hashCode());
		result = prime * result + ((shard == null) ? 0 : shard.hashCode());
		result = prime * result + ((to == null) ? 0 : to.hashCode());
		return result;
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		Move other = (Move) obj;
		if (from == null) {
			if (other.from != null)
				return false;
		} else if (!from.equals(other.from))
			return false;
		if (shard == null) {
			if (other.shard != null)
				return false;
		} else if (!shard.equals(other.shard))
			return false;
		if (to == null) {
			if (other.to != null)
				return false;
		} else if (!to.equals(other.to))
			return false;
		return true;
	}

}
