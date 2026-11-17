package lk.trafficease.routing;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.time.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static lk.trafficease.routing.RoutingModels.*;

@Service
public class RouteWeatherService {
    public record Point(double latitude,double longitude) {}
    public record Sample(Point requestedPoint,Point forecastGridPoint,String validFor,String retrievedAt,
                         double precipitationMm,Double precipitationProbability,int weatherCode,String category) {}
    public record RouteWeather(String routeId,String category,List<Sample> samples) {}
    public record WeatherResult(String status,String source,String retrievedAt,String validFor,String message,
                                List<RouteWeather> routes,boolean manualSimulationAvailable,String forecastIssueTime) {}
    private record Cached(JsonNode data,Instant expires,String retrievedAt) {}
    private final Map<String,Cached> cache=new LinkedHashMap<>();
    private final ProviderClient provider;
    private final String url;
    private Instant day=Instant.EPOCH,minute=Instant.EPOCH;
    private int dayLocations=0,minuteLocations=0;
    public RouteWeatherService(ProviderClient provider,@Value("${trafficease.weather-url:https://api.open-meteo.com/v1/forecast}") String url) { this.provider=provider;this.url=url; }
    public static String category(double mm,int code) {
        if(!Double.isFinite(mm)||mm<0)throw new IllegalArgumentException("Invalid precipitation");
        if(!Set.of(0,1,2,3,51,53,55,61,63,65,80,81,82,95,96,99).contains(code))throw new IllegalArgumentException("Weather condition outside dry/rain training categories (e.g. fog, freezing precipitation or snow)");
        if(mm>=7.5 || Set.of(65,82,95,96,99).contains(code))return "HEAVY_RAIN";
        if(mm>=.1 || Set.of(51,53,55,61,63,80,81).contains(code))return "RAIN";
        return "CLEAR";
    }
    private static int severity(String c) { return List.of("CLEAR","RAIN","HEAVY_RAIN").indexOf(c); }
    static double metres(List<Double> a,List<Double> b) {
        double p=Math.toRadians(a.get(1)),q=Math.toRadians(b.get(1));
        double h=Math.pow(Math.sin((q-p)/2),2)+Math.cos(p)*Math.cos(q)*Math.pow(Math.sin(Math.toRadians(b.get(0)-a.get(0))/2),2);
        return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));
    }
    public static List<Point> representativePoints(RoadRoute route) {
        var p=route.geometry().coordinates();double total=0;
        for(int i=1;i<p.size();i++)total+=metres(p.get(i-1),p.get(i));
        var result=new ArrayList<Point>();
        for(double fraction:new double[]{.1,.5,.9}) {
            double wanted=total*fraction,used=0;Point point=new Point(p.get(0).get(1),p.get(0).get(0));
            for(int i=1;i<p.size();i++) {
                var a=p.get(i-1);var b=p.get(i);double length=metres(a,b);
                if(length>0 && used+length>=wanted) { double t=(wanted-used)/length;point=new Point(round(a.get(1)+t*(b.get(1)-a.get(1))),round(a.get(0)+t*(b.get(0)-a.get(0))));break; }
                used+=length;
            }
            result.add(point);
        }
        return result;
    }
    private static double round(double d) { return Math.round(d*10000)/10000.0; }
    private static String encoded(String s) { return URLEncoder.encode(s,StandardCharsets.UTF_8); }
    public synchronized WeatherResult automatic(RouteResponse routes,Instant at) {
        String hour=at.atZone(JourneyTime.ZONE).withMinute(0).withSecond(0).withNano(0).toLocalDateTime().toString();
        var points=routes.routes().stream().flatMap(r->representativePoints(r).stream()).toList();
        String lat=String.join(",",points.stream().map(p->Double.toString(p.latitude())).toList());
        String lon=String.join(",",points.stream().map(p->Double.toString(p.longitude())).toList());
        String key=lat+"|"+lon;
        try {
            Instant now=Instant.now();var cached=cache.get(key);
            if(cached==null||!cached.expires().isAfter(now)||!hasHour(cached.data(),hour)) {
                if(!now.isBefore(day.plus(Duration.ofDays(1)))) {day=now;dayLocations=0;}
                if(!now.isBefore(minute.plusSeconds(60))) {minute=now;minuteLocations=0;}
                if(dayLocations+points.size()>1000||minuteLocations+points.size()>60)throw new ApiFailure(429,"WEATHER_BUDGET","Conservative public weather request budget reached. Wait or choose explicit manual simulation.");
                dayLocations+=points.size();minuteLocations+=points.size();
                JsonNode response=provider.get("weather",url+"?latitude="+encoded(lat)+"&longitude="+encoded(lon)+"&hourly=precipitation,precipitation_probability,weather_code&forecast_days=8&timezone=Asia%2FColombo");
                cached=new Cached(response,now.plusSeconds(1800),now.toString());
                if(cache.size()>=128)cache.remove(cache.keySet().iterator().next());
                cache.put(key,cached);
            }
            return parse(cached.data(),routes,points,hour,cached.retrievedAt());
        } catch(ApiFailure|IllegalArgumentException error) {
            return new WeatherResult("UNAVAILABLE","Open-Meteo",null,hour+"+05:30",error.getMessage(),List.of(),true,null);
        }
    }
    private static boolean hasHour(JsonNode data,String hour) {
        var first=data.isArray()&&!data.isEmpty()?data.get(0):data;
        for(var h:first.path("hourly").path("time"))if(h.asText().equals(hour))return true;
        return false;
    }
    public static WeatherResult parse(JsonNode data,RouteResponse routing,List<Point> points,String hour,String retrievedAt) {
        if(!data.isArray()||data.size()!=points.size())throw new IllegalArgumentException("Weather provider did not return every requested route sample");
        var result=new ArrayList<RouteWeather>();
        for(int route=0;route<routing.routes().size();route++) {
            var samples=new ArrayList<Sample>();String worst="CLEAR";
            for(int n=0;n<3;n++) {
                int index=route*3+n;var node=data.get(index);
                if(!"Asia/Colombo".equals(node.path("timezone").asText())||node.path("utc_offset_seconds").asInt()!=19800)throw new IllegalArgumentException("Weather timezone is missing or inconsistent");
                var hourly=node.path("hourly");int slot=-1;
                for(int i=0;i<hourly.path("time").size();i++)if(hourly.path("time").get(i).asText().equals(hour)) {slot=i;break;}
                if(slot<0)throw new IllegalArgumentException("Requested departure hour is outside returned forecast coverage");
                var rain=hourly.path("precipitation").path(slot);var code=hourly.path("weather_code").path(slot);var probability=hourly.path("precipitation_probability").path(slot);
                if(!rain.isNumber()||!code.isIntegralNumber()||!node.path("latitude").isNumber()||!node.path("longitude").isNumber())throw new IllegalArgumentException("Weather forecast values are missing");
                if(!"mm".equals(node.path("hourly_units").path("precipitation").asText()))throw new IllegalArgumentException("Unsupported weather precipitation units");
                double mm=rain.asDouble();String category=category(mm,code.asInt());
                Double chance=probability.isNumber()?probability.asDouble():null;
                if(chance!=null&&(!Double.isFinite(chance)||chance<0||chance>100))throw new IllegalArgumentException("Invalid rain probability");
                var grid=new Point(node.path("latitude").asDouble(),node.path("longitude").asDouble());
                var requested=points.get(index);
                if(!Double.isFinite(grid.latitude())||!Double.isFinite(grid.longitude())||Math.abs(grid.latitude()-requested.latitude())>.25||Math.abs(grid.longitude()-requested.longitude())>.25)throw new IllegalArgumentException("Forecast grid is too far from its requested route sample");
                samples.add(new Sample(requested,grid,hour+"+05:30",retrievedAt,mm,chance,code.asInt(),category));
                if(severity(category)>severity(worst))worst=category;
            }
            result.add(new RouteWeather(routing.routes().get(route).id(),worst,samples));
        }
        return new WeatherResult("AVAILABLE","Open-Meteo",retrievedAt,hour+"+05:30","Worst mapped rain category across distance-weighted 10%, 50%, 90% route samples. Hourly forecast, not measured weather. Retrieval time is not model issue time; issue time is not supplied.",result,true,null);
    }
    public WeatherResult manual(RouteResponse routing,String category) {
        if(category==null||!Set.of("CLEAR","RAIN","HEAVY_RAIN").contains(category))throw new ApiFailure(400,"INVALID_WEATHER_SIMULATION","Select CLEAR, RAIN or HEAVY_RAIN for explicit manual simulation.");
        return new WeatherResult("MANUAL_SIMULATION","USER_SIMULATION",null,null,"User-selected weather simulation, not an automatic forecast.",routing.routes().stream().map(r->new RouteWeather(r.id(),category,List.of())).toList(),true,null);
    }
}
