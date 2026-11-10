package lk.trafficease.history;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@Profile("mysql")
public class MySqlConfiguration {
    @Bean(destroyMethod = "close")
    public HikariDataSource historyDataSource(@Value("${DB_URL}") String url,
            @Value("${DB_USER}") String username, @Value("${DB_PASSWORD}") String password) {
        // This coursework profile is local only; forbid public database endpoints.
        if (!url.startsWith("jdbc:mysql://127.0.0.1:3306/trafficease?") || password.isBlank())
            throw new IllegalArgumentException("MySQL profile requires the documented loopback database URL and a protected password");
        var config = new HikariConfig();
        config.setJdbcUrl(url); config.setUsername(username); config.setPassword(password);
        config.setMaximumPoolSize(2); config.setMinimumIdle(0); config.setConnectionTimeout(3000);
        config.setPoolName("synthetic-history");
        return new HikariDataSource(config);
    }
    @Bean(initMethod = "migrate")
    public Flyway historyMigrations(HikariDataSource historyDataSource) {
        return Flyway.configure().dataSource(historyDataSource).locations("classpath:db/migration").baselineOnMigrate(true).baselineVersion("0").load();
    }
    @Bean
    @DependsOn("historyMigrations")
    public JdbcTemplate historyJdbc(HikariDataSource historyDataSource) { return new JdbcTemplate(historyDataSource); }
}
