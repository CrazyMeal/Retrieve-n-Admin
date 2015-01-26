package server;

import io.netty.channel.ChannelHandlerAdapter;
import io.netty.channel.ChannelHandlerContext;
import io.netty.handler.codec.http.HttpContentCompressor;
import io.netty.handler.codec.http.HttpObjectAggregator;
import io.netty.handler.codec.http.HttpRequest;
import io.netty.handler.stream.ChunkedWriteHandler;

/**
 * Netty Handler which look at the URL, and replace the BadRequest Handler by the requested one
 * @author Denaux Robin
 */
public class RequestRouter extends ChannelHandlerAdapter {

    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {

        if (msg instanceof HttpRequest) {
            HttpRequest request = (HttpRequest) msg;

            System.out.println("Request received for URI : " + request.getUri());
            ctx.pipeline().remove("RequestHandler");
            if(request.getUri().equals("/aboutCluster")) {
            	ctx.pipeline().addLast("deflater", new HttpContentCompressor(1));
                ctx.pipeline().addLast("RequestHandler", new AboutCluster());
            }
            else if(request.getUri().equals("/applyChanges")) {
            	ctx.pipeline().addLast("deflater", new HttpContentCompressor(1));
                ctx.pipeline().addLast("RequestHandler", new ApplyChanges());
            }
            else if(request.getUri().equals("/grabData")) {
            	ctx.pipeline().addLast("deflater", new HttpContentCompressor(1));
                ctx.pipeline().addLast("RequestHandler", new GrabData());
            }
            else {
                if(ctx.pipeline().get("aggregator") == null)
                    ctx.pipeline().addLast("aggregator", new HttpObjectAggregator(65536));
                if(ctx.pipeline().get("chunkedWriter") == null)
                    ctx.pipeline().addLast("chunkedWriter", new ChunkedWriteHandler());
                ctx.pipeline().addLast("RequestHandler", new FileHandler(true));
            }

        }
        super.channelRead(ctx, msg);
    }


}
