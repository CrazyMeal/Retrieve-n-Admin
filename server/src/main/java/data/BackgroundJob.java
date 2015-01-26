package data;

import java.io.Closeable;
import java.io.IOException;
import java.lang.Thread.UncaughtExceptionHandler;
import java.util.Calendar;
import java.util.Date;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.logging.Level;
import java.util.logging.Logger;

public abstract class BackgroundJob implements Runnable, Comparable<BackgroundJob> {
	private static volatile int ids = 0;
	private static volatile boolean done = true;
	private static Set<BackgroundJob> jobs = new TreeSet<BackgroundJob>();
	private static final ReentrantReadWriteLock uninterruptibleLock = new ReentrantReadWriteLock();

	private static synchronized int newId() {
		return ids++;
	}
	
	public static void checkBackgroundJobs(Logger logger) {
		Set<BackgroundJob> rjobs;
		synchronized (jobs) {
			rjobs = new TreeSet<BackgroundJob>(jobs);
		}
		for (BackgroundJob job : rjobs) {
			if (job.shouldContinue() && !job.isAlive())
				job.start();
		}
	}
	
	public static void startBackgroundJobs() {
		if (!done)
			return;
		uninterruptibleLock.writeLock().lock();
		try {
			if (!done)
				return;
			Thread jobCleaner = new Thread() {
				@Override
				public void run() {
					while (true) {
						cleanupJobs();
						
						try {
							Thread.sleep(1000);
						} catch (InterruptedException e) {
							e.printStackTrace();
						}
					}
				}
			};
			jobCleaner.setDaemon(true);
			jobCleaner.setPriority(Thread.MIN_PRIORITY);
			jobCleaner.start();
			done = false;
		} finally {
			uninterruptibleLock.writeLock().unlock();
		}
	}
	
	public static void stopBackgroundJobs(Logger logger) {
		if (done)
			return;
		uninterruptibleLock.writeLock().lock();
		try {
			if (done)
				return;
			Set<BackgroundJob> rjobs;
			synchronized (jobs) {
				rjobs = new TreeSet<BackgroundJob>(jobs);
			}
			for (BackgroundJob job : rjobs) {
				job.stopThread();
			}
			
			int attempts = 600;
			do {
				attempts--;
				try {
					Thread.sleep(100);
				} catch (InterruptedException e) {
					logger.log(Level.WARNING, e.getMessage(), e);
				}
				cleanupJobs();
			} while ((! jobs.isEmpty()) && attempts > 0); //Waiting 60s for jobs to close
			
			if (! jobs.isEmpty()) { //Killing resisting jobs
				synchronized (jobs) {
					rjobs = new TreeSet<BackgroundJob>(jobs);
				}
				for (BackgroundJob job : rjobs) {
					if (job.isAlive()) {
						try {
							logger.severe("Job " + job.getName() + " seems stacked");
							job.runningThread.setDaemon(true);
							job.runningThread.interrupt();
						} catch (Exception x) {}
					}
					logger.info("Job " + job.getName() + " closed.");
				}
			}
			done = true;
		} finally {
			uninterruptibleLock.writeLock().unlock();
		}
	}
	
	private static void cleanupJobs() {
		synchronized (jobs) {
			Set<BackgroundJob> rjobs;
			synchronized (jobs) {
				rjobs = new TreeSet<BackgroundJob>(jobs);
			}
			for (BackgroundJob job : rjobs) {
				if (!job.isAlive()) {
					if (job.shouldContinue()) {
						job.getLogger().warning("For some (bad) reason, job " + job.getName() + " was found inactive ; restarting.");
						job.closeAll();
						job.start();
					} else {
						synchronized (jobs) {
							jobs.remove(job);
						}
					}
				}
			}
		}
	}
	
	public static boolean enterUninterruptibleSection() {
		return uninterruptibleLock.readLock().tryLock();
	}
	
	public static void leaveUninterruptibleSection() {
		uninterruptibleLock.readLock().unlock();
	}

	private volatile boolean thread = true;
	private final Logger logger;
	private final int number;
	private final String name;
	private Thread runningThread = null;
	private UncaughtExceptionHandler exceptionHandler = null;
	
	private List<Closeable> toBeClosed;
	
	public BackgroundJob() {
		this(null);
	}
	
	public BackgroundJob(Logger logger) {
		this.number = newId();
		this.name = this.getClass().getName() + '#' + this.number;
		this.logger = logger == null ? Logger.getLogger(getName()) : logger;
		this.logger.info("Job name : "+name+" created");
	}

	public String getName() {
		return name;
	}

	public int getNumber() {
		return this.number;
	}

	public Logger getLogger() {
		return logger;
	}

	public UncaughtExceptionHandler getExceptionHandler() {
		return exceptionHandler;
	}

	public void setExceptionHandler(UncaughtExceptionHandler exceptionHandler) {
		this.exceptionHandler = exceptionHandler;
	}

	public synchronized void start() {
		this.thread = true;
		if (! this.isAlive()) {
			synchronized (jobs) {
				jobs.add(this);
			}
			startBackgroundJobs();
			this.runningThread = new Thread(this, this.getName());
			UncaughtExceptionHandler exh = this.getExceptionHandler();
			if (exh != null)
				this.runningThread.setUncaughtExceptionHandler(exh);
			this.runningThread.setDaemon(false);
			this.runningThread.start();
		}
	}
	
	public synchronized boolean isAlive() {
		return this.runningThread != null && this.runningThread.isAlive();
	}

	protected void addCloseable(Closeable closeable) {
		if (toBeClosed == null)
			toBeClosed = new LinkedList<Closeable>();
		this.toBeClosed.add(closeable);
	}
	
	protected void close(Closeable closeable) {
		if (toBeClosed != null)
			this.toBeClosed.remove(closeable);
		try {
			closeable.close();
		} catch (IOException e) {
			getLogger().log(Level.WARNING, "Error while closing " + closeable, e);
		}
	}
	
	protected void closeAll() {
		if (toBeClosed == null)
			return;
		List<Closeable> tbc;
		synchronized(this) {
			tbc = this.toBeClosed;
			this.toBeClosed = null;
		}
		Iterator<Closeable> ci = tbc.iterator();
		while(ci.hasNext()) {
			this.close(ci.next());
		}
		tbc.clear();
	}
	
	public boolean shouldContinue() {
		return this.thread;
	}
	
	protected boolean shouldContinueDaily(int hour, int minute) {
		Date now = new Date();
		Calendar c = Calendar.getInstance();
		c.set(Calendar.HOUR_OF_DAY, hour);
		c.set(Calendar.MINUTE, minute);
		c.set(Calendar.SECOND, 0);
		c.set(Calendar.MILLISECOND, 0);
		if (now.after(c.getTime()))
			c.add(Calendar.DATE, 1);
		assert c.getTime().after(now);
		assert c.getTime().getTime()-now.getTime() < 24*60*60*1000;
		return this.shouldContinue(c.getTime());
	}
	
	protected boolean shouldContinue(Date expected) {
		if (expected.after(new Date()))
			return this.shouldContinue(expected.getTime()-System.currentTimeMillis());
		else
			return this.shouldContinue();
	}
	
	protected boolean shouldContinue(long waitMs) {
		if (waitMs <= 0)
			return this.shouldContinue();
		if (!this.shouldContinue())
			return false;
		try {
			synchronized(this) {
				this.wait(waitMs);
			}
			return this.shouldContinue();
		} catch (InterruptedException e) {
			if (this.shouldContinue()) {
				getLogger().log(Level.WARNING, "Error while waiting for next execution of job " + this.getName(), e);
				return true;
			} else {
				return false;
			}
		}
		
	}

	public void stopThread() {
		if (this.thread) {
			thread = false;
			synchronized(this) {
				this.notify();
			}
		}
	}
	
	public boolean wasInvokedStop() {
		return !this.thread;
	}

	@Override
	public int compareTo(BackgroundJob o) {
		return this.number - o.number;
	}

	@Override
	public abstract void run();
	
}
