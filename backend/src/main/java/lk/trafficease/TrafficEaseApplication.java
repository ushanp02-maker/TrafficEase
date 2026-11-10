package lk.trafficease;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
@SpringBootApplication(exclude = {org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration.class, org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration.class})
public class TrafficEaseApplication {
    public static void main(String[] args) { SpringApplication.run(TrafficEaseApplication.class, args); }
}
