package server;

import io.netty.buffer.Unpooled;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.handler.codec.DecoderResult;
import io.netty.handler.codec.http.*;
import io.netty.util.CharsetUtil;

import java.io.IOException;

import org.jboss.netty.handler.codec.http.HttpHeaders;

import static io.netty.handler.codec.http.HttpHeaders.Names.*;
import static io.netty.handler.codec.http.HttpHeaders.Values;
import static io.netty.handler.codec.http.HttpHeaders.isKeepAlive;
import static io.netty.handler.codec.http.HttpResponseStatus.BAD_REQUEST;
import static io.netty.handler.codec.http.HttpResponseStatus.INTERNAL_SERVER_ERROR;
import static io.netty.handler.codec.http.HttpResponseStatus.OK;
import static io.netty.handler.codec.http.HttpVersion.HTTP_1_1;
import static org.jboss.netty.handler.codec.http.HttpHeaders.Names.CACHE_CONTROL;
import static org.jboss.netty.handler.codec.http.HttpHeaders.Names.EXPIRES;

/**
 * Netty Handler which force the server to grab data
 * It was useful before the background job was implemented
 * @author Denaux Robin
 */
public class GrabData extends SimpleChannelInboundHandler<Object> {

    private HttpRequest request;

    @Override
    protected void messageReceived(ChannelHandlerContext ctx, Object msg) throws Exception {
        if (msg instanceof HttpRequest) {
            HttpRequest request = this.request = (HttpRequest) msg;

            appendDecoderResult(request);
        }
        if (msg instanceof HttpContent) {
            appendDecoderResult(request);

            if (msg instanceof LastHttpContent) {
                LastHttpContent trailer = (LastHttpContent) msg;

                writeResponse(trailer, ctx);
            }
        }
    }

    private boolean writeResponse(HttpObject currentObj, ChannelHandlerContext ctx) {

        boolean success = true;
        try {
            Main.regionStatsGrabber.grabData();
        } catch (IOException e) {
            e.printStackTrace();
            success=false;
        }


        // Decide whether to close the connection or not.
        boolean keepAlive = isKeepAlive(request);
        // Build the response object.
        FullHttpResponse response = new DefaultFullHttpResponse(
                HTTP_1_1, currentObj.getDecoderResult().isSuccess() ? OK : success?BAD_REQUEST:INTERNAL_SERVER_ERROR,
                Unpooled.copiedBuffer(success?"done":"Erreur lors de l'accès au store", CharsetUtil.UTF_8));



        response.headers().set(CONTENT_TYPE, "text/plain; charset=UTF-8");
		response.headers().set(CACHE_CONTROL, HttpHeaders.Values.NO_CACHE + ','
											+ HttpHeaders.Values.NO_STORE + ','
											+ HttpHeaders.Values.MUST_REVALIDATE);
		response.headers().set(EXPIRES, "Thu, 01 Dec 1994 16:00:00 GMT");

        if (keepAlive) {
            // Add 'Content-Length' header only for a keep-alive connection.
            response.headers().set(CONTENT_LENGTH, response.content().readableBytes());
            // Add keep alive header as per:
            // - http://www.w3.org/Protocols/HTTP/1.1/draft-ietf-http-v11-spec-01.html#Connection
            response.headers().set(CONNECTION, Values.KEEP_ALIVE);
        }
        //allow the client to query these data
        response.headers().set("Access-Control-Allow-Origin", "*");

        // Write the response.
        ctx.write(response);

        return keepAlive;
    }

    /**
     * Log decoder errors
     */
    private static void appendDecoderResult(HttpObject o) {
        DecoderResult result = o.getDecoderResult();
        if (result.isSuccess()) {
            return;
        }

        System.err.println("error when decoding the request : " + result.cause());
    }


    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) { // (4)
        // Close the connection when an exception is raised.
        cause.printStackTrace();
        ctx.close();
    }

    @Override
    public void channelReadComplete(ChannelHandlerContext ctx) throws Exception {
        ctx.flush();
    }


}
