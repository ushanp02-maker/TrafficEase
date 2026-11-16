package lk.trafficease.government;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import static lk.trafficease.government.GovernmentModels.*;

@Service
public class GovernmentService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final Map<String,Announcement> memory = new LinkedHashMap<>();
    private final List<Audit> audit = new ArrayList<>();
    public GovernmentService(ObjectProvider<JdbcTemplate> provider, ObjectMapper mapper) { this.jdbc=provider.getIfAvailable();this.mapper=mapper; }
    public String storage() { return jdbc == null ? "VOLATILE_DEMO_MEMORY" : "MYSQL"; }
    public synchronized List<Announcement> all() {
        if (jdbc == null) { var list=new ArrayList<>(memory.values());Collections.reverse(list);return list; }
        return jdbc.query("SELECT payload FROM government_demo_announcements ORDER BY updated_at DESC LIMIT 500",(rs,n)->decode(rs.getString(1)));
    }
    private Announcement decode(String json) { try { return mapper.readValue(json,Announcement.class); } catch(Exception e) { throw new IllegalStateException("Invalid stored demo announcement",e); } }
    private String encode(Announcement value) { try { return mapper.writeValueAsString(value); } catch(Exception e) { throw new IllegalStateException(e); } }
    public List<Announcement> published(String category,String region) {
        return all().stream().filter(a -> a.status().equals("PUBLISHED") && Instant.parse(a.validUntil()).isAfter(Instant.now()))
            .filter(a -> category == null || category.isBlank() || a.category().equals(category))
            .filter(a -> region == null || region.isBlank() || a.region().equals(region) || a.region().equals("NATIONWIDE")).toList();
    }
    private Announcement find(String id) { return all().stream().filter(a->a.id().equals(id)).findFirst().orElseThrow(()->new Problem(404,"Demo announcement not found.")); }
    private static String text(String value,int min,int max,String label) {
        if(value==null || value.strip().length()<min || value.strip().length()>max || value.chars().anyMatch(c->Character.isISOControl(c) && c!='\n' && c!='\t')) throw new Problem(400,"Invalid "+label+".");
        return value.strip();
    }
    private Edit validate(Edit e) {
        if(e==null || e.category()==null || e.region()==null || !CATEGORIES.contains(e.category()) || !REGIONS.contains(e.region())) throw new Problem(400,"Select a supported category and province.");
        Instant start,end;
        try { start=OffsetDateTime.parse(e.validFrom()).toInstant();end=OffsetDateTime.parse(e.validUntil()).toInstant(); }
        catch(Exception error) { throw new Problem(400,"Use relevant dates with explicit timezone offsets."); }
        if(!end.isAfter(start) || Duration.between(start,end).compareTo(Duration.ofDays(90))>0) throw new Problem(400,"End time must follow start time, within a 90-day window.");
        return new Edit(text(e.title(),3,120,"title"),text(e.body(),10,2000,"announcement text"),e.category(),e.region(),text(e.affectedArea(),2,120,"affected area"),start.toString(),end.toString(),e.revision());
    }
    public synchronized Announcement create(Edit input,String actor) {
        Edit e=validate(input);
        if(all().size()>=500) throw new Problem(409,"Demo capacity reached (500 announcements). Archive old coursework data with an operator review.");
        String now=Instant.now().toString();
        var a=new Announcement(UUID.randomUUID().toString(),e.title(),e.body(),e.category(),e.region(),e.affectedArea(),e.validFrom(),e.validUntil(),"DRAFT",now,now,null,1,true);
        store(a,0,actor,"CREATE");return a;
    }
    public synchronized Announcement update(String id,Edit input,String actor) {
        var old=find(id);Edit e=validate(input);
        if(e.revision()==null || e.revision()!=old.revision()) throw new Problem(409,"Announcement changed. Reload before editing.");
        var a=new Announcement(id,e.title(),e.body(),e.category(),e.region(),e.affectedArea(),e.validFrom(),e.validUntil(),old.status(),old.createdAt(),Instant.now().toString(),old.publishedAt(),old.revision()+1,true);
        store(a,old.revision(),actor,"EDIT");return a;
    }
    public synchronized Announcement state(String id,String status,long revision,String actor) {
        var old=find(id);
        if(revision!=old.revision()) throw new Problem(409,"Announcement changed. Reload before publishing.");
        if(status==null || !Set.of("PUBLISHED","WITHDRAWN").contains(status)) throw new Problem(400,"Choose publish or withdraw.");
        if(status.equals("PUBLISHED") && !Instant.parse(old.validUntil()).isAfter(Instant.now())) throw new Problem(400,"Expired announcements cannot be published.");
        String now=Instant.now().toString();
        var a=new Announcement(id,old.title(),old.body(),old.category(),old.region(),old.affectedArea(),old.validFrom(),old.validUntil(),status,old.createdAt(),now,status.equals("PUBLISHED")?now:old.publishedAt(),old.revision()+1,true);
        store(a,old.revision(),actor,status);return a;
    }
    private void store(Announcement a,long old,String actor,String action) {
        if(jdbc==null) { memory.put(a.id(),a); addAudit(actor,action,a.id()); return; }
        new TransactionTemplate(new DataSourceTransactionManager(Objects.requireNonNull(jdbc.getDataSource()))).executeWithoutResult(tx->{
            if(old==0) jdbc.update("INSERT INTO government_demo_announcements(id,payload,revision,updated_at) VALUES(?,?,?,?)",a.id(),encode(a),a.revision(),Timestamp.from(Instant.parse(a.updatedAt())));
            else if(jdbc.update("UPDATE government_demo_announcements SET payload=?,revision=?,updated_at=? WHERE id=? AND revision=?",encode(a),a.revision(),Timestamp.from(Instant.parse(a.updatedAt())),a.id(),old)!=1) throw new Problem(409,"Concurrent update detected; reload first.");
            addAudit(actor,action,a.id());
        });
    }
    private void addAudit(String actor,String action,String id) {
        var row=new Audit(UUID.randomUUID().toString(),actor,action,id,Instant.now().toString());
        if(jdbc==null) { audit.add(row);if(audit.size()>5000)audit.remove(0); }
        else {
            jdbc.update("DELETE FROM government_demo_audit WHERE occurred_at < ?",Timestamp.from(Instant.now().minus(Duration.ofDays(90))));
            jdbc.update("INSERT INTO government_demo_audit VALUES(?,?,?,?,?)",row.id(),actor,action,id,Timestamp.from(Instant.parse(row.at())));
        }
        Runnable log=()->org.slf4j.LoggerFactory.getLogger(getClass()).info("government_demo_audit actor={} action={} announcement={} event={}",actor,action,id,row.id());
        if(org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization() {
                @Override public void afterCommit() { log.run(); }
            });
        } else log.run();
    }
    public synchronized void loginAudit(String actor,boolean success) { loginAudit(actor,success,success?"LOGIN":"LOGIN_FAILED"); }
    public synchronized void loginAudit(String actor,boolean success,String action) {
        // Authentication must not leak credentials or become unavailable because an optional audit database is down.
        try { addAudit(actor,action,""); } catch(org.springframework.dao.DataAccessException e) { org.slf4j.LoggerFactory.getLogger(getClass()).warn("Government demo authentication audit storage unavailable actor={} action={}",actor,action); }
    }
    public synchronized List<Audit> audits() {
        if(jdbc==null) { var list=new ArrayList<>(audit);Collections.reverse(list);return list.stream().limit(30).toList(); }
        return jdbc.query("SELECT * FROM government_demo_audit ORDER BY occurred_at DESC LIMIT 30",(r,n)->new Audit(r.getString("id"),r.getString("actor"),r.getString("action"),r.getString("announcement_id"),r.getTimestamp("occurred_at").toInstant().toString()));
    }
    public Map<String,Object> analytics() {
        var values=all();var categories=new TreeMap<String,Long>();for(String c:CATEGORIES) categories.put(c,values.stream().filter(a->a.category().equals(c)).count());
        return Map.of("demonstration",true,"storage",storage(),"totalAnnouncements",values.size(),"published",published(null,null).size(),"categories",categories,
            "mobilityCollectionEnabled",false,"realDemandAvailable",false,"source","ADMIN_CREATED_DEMO_NOTICES",
            "illustration",Map.of("source","SYNTHETIC_ILLUSTRATION_NOT_CITIZEN_TRIPS","periods",List.of(Map.of("label","Morning","value",42),Map.of("label","Midday","value",24),Map.of("label","Evening","value",58)),"corridors",List.of(Map.of("label","Fictional corridor A","value",58),Map.of("label","Fictional corridor B","value",31),Map.of("label","Fictional corridor C","value",19))));
    }
}
