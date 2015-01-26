package server;


import data.ClusterToJSONIf;
import data.RegionsStatsGrabberIf;
import data.hbase.HBaseClusterToJSON;
import data.hbase.HBaseRegionsStatsGrabber;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.*;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.HttpRequestDecoder;
import io.netty.handler.codec.http.HttpResponseEncoder;
import move.RegionMoverIf;
import move.hbase.HBaseRegionMover;
import org.apache.commons.io.IOUtils;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import server.cluster.RegionsStat;

import java.io.*;
import java.util.Arrays;
import java.util.Date;
import java.util.List;

/**
 * Read the config file and launch the server
 * @author Denaux Robin
 */


public class Main {

    public static String pathToConfig = "server/cluster/config.json";

    public static ClusterToJSONIf clusterToJSON;
    public static RegionMoverIf regionMover;
    public static RegionsStatsGrabberIf regionStatsGrabber;

    //used to put random weight to shards
    public static boolean DEBUG = false;

    private ChannelFuture f;
    public static JSONObject config;
    public static Date timeAtApply;

    /**
     * Parse the config file and launch some {@link data.BackgroundJob} if needed
     */
    public Main(ClusterToJSONIf clusterToJSON, RegionMoverIf regionMover, RegionsStatsGrabberIf regionStatsGrabber, HBaseBalancerManager balancerManager) {
        this.clusterToJSON = clusterToJSON;
        this.regionMover = regionMover;
        this.regionStatsGrabber = regionStatsGrabber;
        timeAtApply = new Date();

        //should the database balancer run?
        if((Boolean)config.get("runBalancer"))
            balancerManager.startBalancer();
        else
            balancerManager.stopBalancer();

        //should we grab statistics regularly?
        if((Boolean)config.get("runStatisticsGrabber")) {
            regionStatsGrabber.start();
        }

    }

    /**
     * launch the server, and define the netty pipeline
     * @throws Exception
     */
    public void run() throws Exception {
        EventLoopGroup bossGroup = new NioEventLoopGroup();
        EventLoopGroup workerGroup = new NioEventLoopGroup();
        try {
            ServerBootstrap b = new ServerBootstrap();
            b.group(bossGroup, workerGroup)
                    .channel(NioServerSocketChannel.class)
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        public void initChannel(SocketChannel ch) throws Exception {
                            ChannelPipeline p = ch.pipeline();
                            p.addLast(new HttpRequestDecoder());
                            p.addLast(new HttpResponseEncoder());

                            //this one will analyse the URL requested and put the good RequestHandler
                            p.addLast("RequestRouter", new RequestRouter());

                            //default, will be replaced at runtime
                            p.addLast("RequestHandler", new BadRequest());
                        }
                    })
                    .option(ChannelOption.SO_BACKLOG, 128)
                    .childOption(ChannelOption.SO_KEEPALIVE, true);

            f = b.bind(((Long)config.get("port")).intValue()).sync();

            // Wait until the server socket is closed.
            f.channel().closeFuture().sync();
        } finally {
            workerGroup.shutdownGracefully();
            bossGroup.shutdownGracefully();
        }
    }

    /**
     * launch the server
     * @param args no arguments are used as all is in the config file
     * @throws Exception
     */
    public static void main(String[] args) throws Exception {

        try{
            loadConfig();
        }
        catch(IOException e){
            e.printStackTrace();
        }


        new Main(new HBaseClusterToJSON(), new HBaseRegionMover(), new HBaseRegionsStatsGrabber(), new HBaseBalancerManager()).run();
    }

    /**
     * used to stop the server
     */
    public void stop(){
        f.channel().close();
    }

    public static void loadConfig() throws IOException {
        //read and parse the config file
        List<ClassLoader> classLoaders = Arrays.asList(ClassLoader.getSystemClassLoader(), Thread.currentThread().getContextClassLoader(), RegionsStat.class.getClassLoader());

        InputStream in = null;
        for (ClassLoader loader : classLoaders) {
            in = loader.getResourceAsStream("server/cluster/config.json");
            if (in != null) {
                break;
            }
        }
        StringWriter writer = new StringWriter();
        IOUtils.copy(in, writer);
        String json = writer.toString();
        in.close();
        config = (JSONObject)JSONValue.parse(json);


    }
}