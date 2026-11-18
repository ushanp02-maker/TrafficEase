package lk.trafficease.routing;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import static lk.trafficease.routing.RoutingModels.*;

/** Provider-authored maneuvers only. Incomplete step data never becomes invented instructions. */
final class ArDirections {
    record Step(String type,String modifier,String roadName,List<Double> location,Integer exit,
                double distanceMeters,double durationSeconds) {}
    record Directions(String routeId,boolean complete,List<Step> steps) {}
    static List<Directions> parse(JsonNode body,RouteResponse routing) {
        var result=new ArrayList<Directions>();
        for(int i=0;i<routing.routes().size();i++) {
            var road=routing.routes().get(i);var steps=new ArrayList<Step>();
            double length=0,seconds=0;List<Double> end=null;boolean valid=true;int points=0;
            try {
                var legs=body.path("routes").get(i).path("legs");
                if(!legs.isArray()||legs.isEmpty())throw new IllegalArgumentException();
                for(var leg:legs) {
                    if(!leg.path("steps").isArray()||leg.path("steps").isEmpty())throw new IllegalArgumentException();
                    for(var raw:leg.path("steps")) {
                        if(steps.size()>=2048)throw new IllegalArgumentException();
                        var maneuver=raw.path("maneuver");var geometry=raw.path("geometry");var coordinates=geometry.path("coordinates");
                        if(!maneuver.path("type").isTextual()||!Set.of("turn","new name","depart","arrive","merge","on ramp","off ramp","fork","end of road","use lane","continue","roundabout","rotary","roundabout turn","notification","exit roundabout","exit rotary").contains(maneuver.path("type").asText())||(maneuver.has("modifier")&&(!maneuver.path("modifier").isTextual()||!Set.of("uturn","sharp right","right","slight right","straight","slight left","left","sharp left").contains(maneuver.path("modifier").asText())))||(raw.has("name")&&!raw.path("name").isTextual()))throw new IllegalArgumentException();
                        if(!"LineString".equals(geometry.path("type").asText())||!coordinates.isArray()||coordinates.isEmpty()||!raw.path("distance").isNumber()||!raw.path("duration").isNumber()||maneuver.path("type").asText().isBlank())throw new IllegalArgumentException();
                        double d=raw.path("distance").asDouble(),t=raw.path("duration").asDouble();
                        if(!Double.isFinite(d)||!Double.isFinite(t)||d<0||t<0)throw new IllegalArgumentException();
                        var location=point(maneuver.path("location"));var first=point(coordinates.get(0));double measured=0;List<Double> previous=null;
                        for(var p:coordinates) {var value=point(p);if(previous!=null)measured+=metres(previous,value);previous=value;if(++points>60000)throw new IllegalArgumentException();}
                        if(metres(location,first)>30||Math.abs(measured-d)>Math.max(30,d*.1))throw new IllegalArgumentException();
                        if(end==null) {if(metres(first,road.geometry().coordinates().get(0))>5)throw new IllegalArgumentException();}
                        else if(metres(end,first)>5)throw new IllegalArgumentException();
                        end=previous;length+=d;seconds+=t;
                        Integer exit=maneuver.path("exit").isIntegralNumber()?maneuver.path("exit").asInt():null;
                        if(exit!=null&&(exit<1||exit>20))throw new IllegalArgumentException();
                        steps.add(new Step(text(maneuver.path("type").asText()),text(maneuver.path("modifier").asText()),text(raw.path("name").asText()),location,exit,d,t));
                    }
                }
                if(end==null||metres(end,road.geometry().coordinates().get(road.geometry().coordinates().size()-1))>5||Math.abs(length-road.distanceMeters())>Math.max(5,road.distanceMeters()*.02)||Math.abs(seconds-road.durationSeconds())>Math.max(5,road.durationSeconds()*.02))throw new IllegalArgumentException();
            } catch(IllegalArgumentException|NullPointerException error) {valid=false;steps.clear();}
            result.add(new Directions(road.id(),valid,List.copyOf(steps)));
        }
        return List.copyOf(result);
    }
    private static List<Double> point(JsonNode p) {
        if(p==null||!p.isArray()||p.size()!=2||!p.get(0).isNumber()||!p.get(1).isNumber()||!LocationService.validCoordinates(p.get(1).asDouble(),p.get(0).asDouble()))throw new IllegalArgumentException();
        return List.of(p.get(0).asDouble(),p.get(1).asDouble());
    }
    private static double metres(List<Double>a,List<Double>b) {return RouteWeatherService.metres(a,b);}
    private static String text(String s) {String clean=s.replaceAll("\\p{Cntrl}","");return clean.substring(0,Math.min(200,clean.length()));}
}
