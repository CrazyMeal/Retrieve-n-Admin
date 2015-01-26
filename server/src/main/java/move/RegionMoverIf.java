package move;

import server.cluster.Change;

import java.util.Set;

/**
 * @author Denaux Robin
 */
public interface RegionMoverIf {

    public void apply(Set<Change> changes) throws Exception;
    public void computeChanges(String JSONOfChanges);
}
