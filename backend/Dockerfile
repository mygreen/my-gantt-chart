FROM eclipse-temurin:21
# RUN addgroup -S spring && adduser -S spring -G spring
# USER spring:spring
# 作業ディレクトリを作成
WORKDIR /app
COPY build/libs/gantt-chart-backend-*.jar /app/app.jar
ENTRYPOINT ["java","-jar","/app/app.jar"]