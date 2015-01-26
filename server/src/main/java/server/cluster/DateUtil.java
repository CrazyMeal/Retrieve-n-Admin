package server.cluster;

import java.text.DecimalFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public class DateUtil {
	private static DecimalFormat dateElementFormatter = new DecimalFormat();
	
	static {
		dateElementFormatter.setMaximumFractionDigits(3);
	}
	
	public static enum FuzzyDate {
		ByTenMinutes,
		ByHour,
		ByDay,
		ByMonth;
		
		public Date getFuzzyfiedDate(Date date) {
			switch(this) {
			case ByTenMinutes: return getTenMinutes(date);
			case ByHour : return getHour(date);
			case ByDay : return getDay(date);
			case ByMonth : return getMonth(date);
			default: throw new Error(this.toString() + ": getFuzzyfiedDate not implemented");
			}
		}
	}
	
	public static Date getTenMinutes(Date date){
		Calendar cal = Calendar.getInstance();
		cal.setTime(date);
		cal.clear(Calendar.MILLISECOND);
		cal.clear(Calendar.SECOND);
		int minute = cal.get(Calendar.MINUTE);
		minute = (minute / 10 )*10 ;
		cal.set(Calendar.MINUTE, minute);

		return cal.getTime();
	}
	
	
	public static Date getHour(Date date){
		Calendar cal = Calendar.getInstance();
		cal.setTime(date);
		cal.clear(Calendar.MILLISECOND);
		cal.clear(Calendar.SECOND);
		cal.clear(Calendar.MINUTE);

		return cal.getTime();
		
	}
	
	public static Date getDay(Date date){
		Calendar cal = Calendar.getInstance();
		cal.setTime(date);
		cal.clear(Calendar.MILLISECOND);
		cal.clear(Calendar.SECOND);
		cal.clear(Calendar.MINUTE);
		cal.set(Calendar.HOUR_OF_DAY, 0);

		return cal.getTime();
	}
	
	public static Date getMonth(Date date){
		Calendar cal = Calendar.getInstance();
		cal.setTime(date);
		cal.clear(Calendar.MILLISECOND);
		cal.clear(Calendar.SECOND);
		cal.clear(Calendar.MINUTE);
		cal.set(Calendar.HOUR_OF_DAY, 0);
		cal.set(Calendar.DAY_OF_MONTH, 1);

		return cal.getTime();
	}

	public static String formatDuration(long durationInMillis) {
		short millis = (short) (durationInMillis%1000);
		
		long durationInSeconds = durationInMillis/1000;
		byte seconds = (byte) (durationInSeconds%60);
		
		long durationInMinutes = durationInSeconds / 60;
		byte minutes = (byte) (durationInMinutes % 60);
		
		long durationInHour = durationInMinutes/60;
		byte hours = (byte) (durationInHour%24);
		
		long durationInDays = durationInHour/24;
		
		StringBuffer ret = new StringBuffer();
		boolean[] needsBlank = {false};
		append(durationInDays, "day", needsBlank, ret);
		append(hours, "hour", needsBlank, ret);
		append(minutes, "minute", needsBlank, ret);
		append(seconds+millis == 0 ? 0.0f : ((float)seconds)+(((float)millis)/1000.0f), "second", needsBlank, ret);
		
		return ret.toString();
	}

	private static void append(float number, String separator, boolean [] needsBlank, StringBuffer ret) {
		if (number > 0) {
			if (needsBlank[0]) ret.append(' ');
			ret.append(dateElementFormatter.format(number));
			ret.append(' ');
			ret.append(separator);
			if (number > 1)
				ret.append('s');
			needsBlank[0] = true;
		}
	}

	public static Date parsePaypalNVPResponseDate(String date){
		// "2012-09-08T22:00:00Z";
		SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.ENGLISH);
		sdf.setTimeZone(TimeZone.getTimeZone("GMT"));
		try {
			return sdf.parse(date);
		} catch (ParseException e) {
			e.printStackTrace();
		}
		return null;
	}
	
	public static String formatPaypalNVPRequestDate(Date date){

		SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
		sdf.setTimeZone(TimeZone.getTimeZone("GMT"));
		return sdf.format(date);
	}
}
