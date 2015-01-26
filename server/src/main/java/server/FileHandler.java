package server;

import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import io.netty.channel.ChannelFuture;
import io.netty.channel.ChannelFutureListener;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelProgressiveFuture;
import io.netty.channel.ChannelProgressiveFutureListener;
import io.netty.channel.DefaultFileRegion;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.handler.codec.http.DefaultFullHttpResponse;
import io.netty.handler.codec.http.DefaultHttpResponse;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.FullHttpResponse;
import io.netty.handler.codec.http.HttpHeaders;
import io.netty.handler.codec.http.HttpResponse;
import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.LastHttpContent;
import io.netty.handler.stream.ChunkedFile;
import io.netty.util.CharsetUtil;

import javax.activation.MimetypesFileTypeMap;

import org.apache.commons.httpclient.util.DateUtil;
import org.apache.commons.io.IOUtils;

import java.io.*;
import java.net.URLDecoder;
import java.util.Date;
import java.util.regex.Pattern;

import static io.netty.handler.codec.http.HttpHeaders.Names.*;
import static io.netty.handler.codec.http.HttpHeaders.*;
import static io.netty.handler.codec.http.HttpMethod.*;
import static io.netty.handler.codec.http.HttpResponseStatus.*;
import static io.netty.handler.codec.http.HttpVersion.*;

/**
 * Netty Handler which will send the file corresponding at the url requested, if possible.
 * It can list a directory if needed.
 */
public class FileHandler extends SimpleChannelInboundHandler<FullHttpRequest> {
	public static int CacheInSec = 30 * 24 * 3600;

    private final boolean useSendFile;

    public FileHandler(boolean useSendFile) {
        this.useSendFile = useSendFile;
    }

    @Override
    public void messageReceived(
            ChannelHandlerContext ctx, FullHttpRequest request) throws Exception {
        if (!request.getDecoderResult().isSuccess()) {
            sendError(ctx, BAD_REQUEST);
            return;
        }

        if (request.getMethod() != GET) {
            sendError(ctx, METHOD_NOT_ALLOWED);
            return;
        }

        final String uri = request.getUri();
        final String path = sanitizeUri(uri);
        if (path == null) {
            sendError(ctx, FORBIDDEN);
            return;
        }

        if(uri.equals("/")) {
            sendRedirect(ctx, uri + "index.html");
            return;
        }

        File file = new File(path);
        if (file.isHidden() || !file.exists()) {
            sendError(ctx, NOT_FOUND);
            return;
        }

        if (file.isDirectory()) {
            if (uri.endsWith("/")) {
                sendListing(ctx, file);
            } else {
                sendRedirect(ctx, uri + '/');
            }
            return;
        }

        if (!file.isFile()) {
            sendError(ctx, FORBIDDEN);
            return;
        }
        
        HttpResponse response = new DefaultHttpResponse(HTTP_1_1, OK);
        setContentTypeHeader(response, file);

    	File gzFile = new File(path + ".gz");
    	if (gzFile.isFile() && gzFile.canRead()) {
    		response.headers().add(VARY, ACCEPT_ENCODING);
    		
	        String ae = request.headers().get(ACCEPT_ENCODING);
	        if (ae != null && ae.contains("gzip")) {
        		file = gzFile;
        		response.headers().add(CONTENT_ENCODING, "gzip");
	        }
    	}

		response.headers().add(CACHE_CONTROL, "max-age=" + CacheInSec);
		response.headers().add(DATE, DateUtil.formatDate(new Date()));
		response.headers().add(EXPIRES, DateUtil.formatDate(new Date(System.currentTimeMillis() + (CacheInSec * 1000))));
		
		long lastModifiedL = file.lastModified();
		if (lastModifiedL % 1000 != 0) {
			lastModifiedL = ((lastModifiedL/1000) + 1 ) * 1000;
			file.setLastModified(lastModifiedL);
			assert file.lastModified() % 1000 == 0;
		}
		Date lastModified = new Date(lastModifiedL);
		response.headers().add(LAST_MODIFIED, DateUtil.formatDate(lastModified));
		String expectedModifiedStr = request.headers().get(IF_MODIFIED_SINCE);
		if (expectedModifiedStr != null) {
			try {
				Date expectedModified = DateUtil.parseDate(expectedModifiedStr);
				if (lastModifiedL != expectedModified.getTime()) {
	    			response.setStatus(NOT_MODIFIED);
	    	        ctx.write(response);
	    	        ctx.writeAndFlush(response).addListener(ChannelFutureListener.CLOSE);
	    	        return;
				}
			} catch (Exception x) {}
		}
		
    	File md5File = new File(file.getAbsolutePath() + ".md5");
    	if (md5File.isFile() && md5File.canRead()) {
    		String md5 = IOUtils.toString(new FileReader(md5File)).trim();
    		response.headers().add(ETAG, md5);
    		
    		String expectedMd5 = request.headers().get(IF_NONE_MATCH);
    		if (md5.equals(expectedMd5)) {
    			response.setStatus(NOT_MODIFIED);
    	        ctx.write(response);
    	        ctx.writeAndFlush(response).addListener(ChannelFutureListener.CLOSE);
    	        return;
    		}
    		
    	}

        RandomAccessFile raf;
        try {
            raf = new RandomAccessFile(file, "r");
        } catch (FileNotFoundException fnfe) {
            sendError(ctx, NOT_FOUND);
            return;
        }
        long fileLength = raf.length();

        setContentLength(response, fileLength);
        if (isKeepAlive(request)) {
            response.headers().set(CONNECTION, HttpHeaders.Values.KEEP_ALIVE);
        }

        // Write the initial line and the header.
        ctx.write(response);

        // Write the content.
        ChannelFuture sendFileFuture;
        if (useSendFile) {
            sendFileFuture =
                    ctx.write(new DefaultFileRegion(raf.getChannel(), 0, fileLength), ctx.newProgressivePromise());
        } else {
            sendFileFuture =
                    ctx.write(new ChunkedFile(raf, 0, fileLength, 8192), ctx.newProgressivePromise());
        }

        sendFileFuture.addListener(new ChannelProgressiveFutureListener() {
            @Override
            public void operationProgressed(ChannelProgressiveFuture future, long progress, long total) {
            }

            @Override
            public void operationComplete(ChannelProgressiveFuture future) throws Exception {
                System.err.println("Transfer complete.");
            }
        });

        // Write the end marker
        ChannelFuture lastContentFuture = ctx.writeAndFlush(LastHttpContent.EMPTY_LAST_CONTENT);

        // Decide whether to close the connection or not.
        if (!isKeepAlive(request)) {
            // Close the connection when the whole content is written out.
            lastContentFuture.addListener(ChannelFutureListener.CLOSE);
        }
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        cause.printStackTrace();
        if (ctx.channel().isActive()) {
            sendError(ctx, INTERNAL_SERVER_ERROR);
        }
    }

    private static String sanitizeUri(String uri) {
        // Decode the path.
        try {
            uri = URLDecoder.decode(uri, "UTF-8");
        } catch (UnsupportedEncodingException e) {
            try {
                uri = URLDecoder.decode(uri, "ISO-8859-1");
            } catch (UnsupportedEncodingException e1) {
                throw new Error();
            }
        }

        if (!uri.startsWith("/")) {
            return null;
        }

        // Convert file separators.
        uri = uri.replace('/', File.separatorChar);

        // Convert to absolute path.
        return System.getProperty("user.dir") + File.separator + "app" + uri;
    }

    private static final Pattern ALLOWED_FILE_NAME = Pattern.compile("[A-Za-z0-9][-_A-Za-z0-9\\.]*");

    private static void sendListing(ChannelHandlerContext ctx, File dir) {
        FullHttpResponse response = new DefaultFullHttpResponse(HTTP_1_1, OK);
        response.headers().set(CONTENT_TYPE, "text/html; charset=UTF-8");

        StringBuilder buf = new StringBuilder();
        String dirPath = dir.getPath();

        buf.append("<!DOCTYPE html>\r\n");
        buf.append("<html><head><title>");
        buf.append("Listing of: ");
        buf.append(dirPath);
        buf.append("</title></head><body>\r\n");

        buf.append("<h3>Listing of: ");
        buf.append(dirPath);
        buf.append("</h3>\r\n");

        buf.append("<ul>");
        buf.append("<li><a href=\"../\">..</a></li>\r\n");

        for (File f: dir.listFiles()) {
            if (f.isHidden() || !f.canRead()) {
                continue;
            }

            String name = f.getName();
            if (!ALLOWED_FILE_NAME.matcher(name).matches()) {
                continue;
            }

            buf.append("<li><a href=\"");
            buf.append(name);
            buf.append("\">");
            buf.append(name);
            buf.append("</a></li>\r\n");
        }

        buf.append("</ul></body></html>\r\n");
        ByteBuf buffer = Unpooled.copiedBuffer(buf, CharsetUtil.UTF_8);
        response.content().writeBytes(buffer);
        buffer.release();

        // Close the connection as soon as the error message is sent.
        ctx.writeAndFlush(response).addListener(ChannelFutureListener.CLOSE);
    }

    private static void sendRedirect(ChannelHandlerContext ctx, String newUri) {
        FullHttpResponse response = new DefaultFullHttpResponse(HTTP_1_1, FOUND);
        response.headers().set(LOCATION, newUri);

        // Close the connection as soon as the error message is sent.
        ctx.writeAndFlush(response).addListener(ChannelFutureListener.CLOSE);
    }

    private static void sendError(ChannelHandlerContext ctx, HttpResponseStatus status) {
        FullHttpResponse response = new DefaultFullHttpResponse(
                HTTP_1_1, status, Unpooled.copiedBuffer("Failure: " + status.toString() + "\r\n", CharsetUtil.UTF_8));
        response.headers().set(CONTENT_TYPE, "text/plain; charset=UTF-8");

        // Close the connection as soon as the error message is sent.
        ctx.writeAndFlush(response).addListener(ChannelFutureListener.CLOSE);
    }

    /**
     * Sets the content type header for the HTTP Response
     *
     * @param response
     *            HTTP response
     * @param file
     *            file to extract content type
     */
    private static void setContentTypeHeader(HttpResponse response, File file) {
        MimetypesFileTypeMap mimeTypesMap = new MimetypesFileTypeMap();
        mimeTypesMap.addMimeTypes("text/html html");
        mimeTypesMap.addMimeTypes("text/css css");
        mimeTypesMap.addMimeTypes("text/javascript js");
        mimeTypesMap.addMimeTypes("application/font-woff woff");
        mimeTypesMap.addMimeTypes("image/png png");
        response.headers().set(CONTENT_TYPE, mimeTypesMap.getContentType(file.getPath()));
    }

}