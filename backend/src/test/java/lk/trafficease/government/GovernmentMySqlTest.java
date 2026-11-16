package lk.trafficease.government;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.time.*;
import lk.trafficease.history.MySqlConfiguration;
import static org.junit.jupiter.api.Assertions.*;
import static lk.trafficease.government.GovernmentModels.*;
@EnabledIfEnvironmentVariable(named="MYSQL_TEST_PASSWORD_FILE",matches=".+")
class GovernmentMySqlTest {
 @Test void additiveMigrationCrudAuditRestartAndRollbackUseActualMySql() throws Exception {
  var config=new MySqlConfiguration();
  try(var pool=config.historyDataSource("jdbc:mysql://127.0.0.1:3306/trafficease?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&sslMode=DISABLED&allowPublicKeyRetrieval=true","te_history",Files.readString(Path.of(System.getenv("MYSQL_TEST_PASSWORD_FILE"))).strip())){
   var migration=config.historyMigrations(pool);migration.migrate();assertEquals(0,migration.migrate().migrationsExecuted);
   var jdbc=new JdbcTemplate(pool);var factory=new StaticListableBeanFactory();factory.addBean("jdbc",jdbc);
   var service=new GovernmentService(factory.getBeanProvider(JdbcTemplate.class),new ObjectMapper());
   assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update("INSERT INTO government_demo_announcements(id,payload,revision,updated_at) VALUES(?,?,1,CURRENT_TIMESTAMP)",java.util.UUID.randomUUID().toString(),"{}"));
   assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update("INSERT INTO government_demo_announcements(id,payload,revision,updated_at) VALUES(?,?,1,CURRENT_TIMESTAMP)",java.util.UUID.randomUUID().toString(),"{\"demonstration\":false}"));
   var input=new Edit("MySQL prototype notice","Clearly marked test notice, not official government information.","GENERAL","NATIONWIDE","Fictional road",Instant.now().toString(),Instant.now().plusSeconds(3600).toString(),null);
   var a=service.create(input,"sql-test-admin");assertTrue(service.published(null,null).stream().noneMatch(v->v.id().equals(a.id())));
   var p=service.state(a.id(),"PUBLISHED",1,"sql-test-admin");assertEquals(2,p.revision());
   var restarted=new GovernmentService(factory.getBeanProvider(JdbcTemplate.class),new ObjectMapper());
   assertTrue(restarted.published(null,"CENTRAL").stream().anyMatch(v->v.id().equals(a.id())));
   assertTrue(restarted.audits().stream().anyMatch(v->v.announcementId().equals(a.id())&&v.action().equals("PUBLISHED")));
   int count=service.all().size();
   assertThrows(org.springframework.dao.DataAccessException.class,()->service.create(input,"x".repeat(65)));
   assertEquals(count,service.all().size(),"Audit insert failure must roll back its announcement atomically");
   service.state(a.id(),"WITHDRAWN",2,"sql-test-admin");assertTrue(restarted.published(null,null).stream().noneMatch(v->v.id().equals(a.id())));
   assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE version='1' AND success=TRUE",Integer.class));
   assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE version='2' AND success=TRUE",Integer.class));
   assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='trafficease' AND table_name LIKE 'government_demo_%' AND column_name IN ('password','password_hash','latitude','longitude','gps')",Integer.class));
  }
 }
}
