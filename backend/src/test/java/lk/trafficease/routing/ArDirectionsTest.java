package lk.trafficease.routing;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static lk.trafficease.routing.RoutingModels.*;
class ArDirectionsTest {
 final ObjectMapper mapper=new ObjectMapper();
 ObjectNode data()throws Exception{return (ObjectNode)mapper.readTree("""
 {"code":"Ok","waypoints":[{"distance":0,"location":[80,7]},{"distance":0,"location":[80.001,7.001]}],"routes":[{"distance":222,"duration":90,"geometry":{"type":"LineString","coordinates":[[80,7],[80,7.001],[80.001,7.001]]},"legs":[{"steps":[
 {"name":"First Road","distance":111,"duration":45,"maneuver":{"type":"depart","location":[80,7]},"geometry":{"type":"LineString","coordinates":[[80,7],[80,7.001]]}},
 {"name":"Second Road","distance":111,"duration":45,"maneuver":{"type":"turn","modifier":"right","location":[80,7.001]},"geometry":{"type":"LineString","coordinates":[[80,7.001],[80.001,7.001]]}},
 {"name":"","distance":0,"duration":0,"maneuver":{"type":"arrive","location":[80.001,7.001]},"geometry":{"type":"LineString","coordinates":[[80.001,7.001]]}}]}]}]}
 """);}
 java.util.List<ArDirections.Directions> parse(JsonNode body){return ArDirections.parse(body,RouteService.parse(body,new Location("a","A",7,80,"LK"),new Location("b","B",7.001,80.001,"LK"),50));}
 @Test void preservesProviderTurnAndBaselineStepValues()throws Exception{var result=parse(data()).get(0);assertTrue(result.complete());assertEquals("right",result.steps().get(1).modifier());assertEquals(111,result.steps().get(1).distanceMeters());assertEquals(90,result.steps().stream().mapToDouble(ArDirections.Step::durationSeconds).sum());}
 @Test void missingManeuversKeepMapButNeverFabricateDirections()throws Exception{var d=data();((ObjectNode)d.path("routes").get(0).path("legs").get(0).path("steps").get(1)).remove("maneuver");assertFalse(parse(d).get(0).complete());assertTrue(parse(d).get(0).steps().isEmpty());}
 @Test void inconsistentTotalsOrDiscontinuousGeometryAreNotNavigationReady()throws Exception{
  var d=data();((ObjectNode)d.path("routes").get(0).path("legs").get(0).path("steps").get(0)).put("duration",400);assertFalse(parse(d).get(0).complete());
  d=data();((ObjectNode)d.path("routes").get(0).path("legs").get(0).path("steps").get(1).path("maneuver")).putArray("location").add(80.5).add(7);assertFalse(parse(d).get(0).complete());
 }
 @Test void unknownOrNontextManeuverNeverBecomesATurn()throws Exception{var d=data();((ObjectNode)d.path("routes").get(0).path("legs").get(0).path("steps").get(1).path("maneuver")).put("type",true);assertFalse(parse(d).get(0).complete());}
 @Test void restResponseSerializesValidatedDirectionsAlongsideExistingFields()throws Exception{
  var provider=org.mockito.Mockito.mock(ProviderClient.class);var locations=org.mockito.Mockito.mock(LocationService.class);
  org.mockito.Mockito.when(provider.get(org.mockito.ArgumentMatchers.eq("routing"),org.mockito.ArgumentMatchers.anyString())).thenReturn(data());
  org.mockito.Mockito.when(locations.selected("destination")).thenReturn(new Location("destination","Destination",7.001,80.001,"LK"));org.mockito.Mockito.when(locations.gpsIsSriLankan(7,80)).thenReturn(true);
  var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new ArRoutingController(provider,locations,"https://routing.invalid")).build();
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/ar/routes").contentType("application/json").content("{\"origin\":{\"latitude\":7,\"longitude\":80,\"accuracyMeters\":5,\"timestamp\":"+System.currentTimeMillis()+"},\"destinationId\":\"destination\"}"))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.directions[0].complete").value(true))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.directions[0].steps[1].modifier").value("right"))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.originSource").value("GPS"));
 }

}
