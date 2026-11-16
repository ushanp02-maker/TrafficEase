package lk.trafficease.government;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import java.security.Principal;
import java.util.*;
import static lk.trafficease.government.GovernmentModels.*;
@RestController
public class GovernmentController {
    private final GovernmentService service;
    public GovernmentController(GovernmentService service) { this.service=service; }
    @GetMapping("/api/announcements") public Map<String,Object> citizen(@RequestParam(required=false) String category,@RequestParam(required=false) String region) {
        if(category!=null && !category.isBlank() && !CATEGORIES.contains(category) || region!=null && !region.isBlank() && !REGIONS.contains(region)) throw new Problem(400,"Unsupported announcement filter.");
        return Map.of("announcements",service.published(category,region),"demonstration",true,"storage",service.storage(),"notice","Administrator-created coursework announcements. Not official government notices.");
    }
    @GetMapping("/api/government/announcements") public Map<String,Object> list() { return Map.of("announcements",service.all(),"storage",service.storage(),"demonstration",true); }
    @PostMapping("/api/government/announcements") public Announcement create(@RequestBody Edit input,Principal actor) { return service.create(input,actor.getName()); }
    @PutMapping("/api/government/announcements/{id}") public Announcement edit(@PathVariable String id,@RequestBody Edit input,Principal actor) { return service.update(id,input,actor.getName()); }
    public record Change(String status,long revision) {}
    @PostMapping("/api/government/announcements/{id}/state") public Announcement state(@PathVariable String id,@RequestBody Change input,Principal actor) { return service.state(id,input.status(),input.revision(),actor.getName()); }
    @GetMapping("/api/government/analytics") public Map<String,Object> analytics() { return service.analytics(); }
    @GetMapping("/api/government/audit") public Map<String,Object> audit() { return Map.of("events",service.audits(),"demonstration",true); }
    @ExceptionHandler(Problem.class) ResponseEntity<?> bad(Problem error) { return ResponseEntity.status(error.status).body(Map.of("message",error.getMessage())); }
    @ExceptionHandler(org.springframework.dao.DataAccessException.class) ResponseEntity<?> database() { return ResponseEntity.status(503).body(Map.of("message","Announcement storage unavailable. No substitute notices were generated.")); }
}
