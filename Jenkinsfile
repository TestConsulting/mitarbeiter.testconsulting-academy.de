pipeline {
  agent any
  triggers { githubPush() }
  environment {
    COMPOSE = 'docker compose -p mitarbeiter-portal --env-file /var/www/mitarbeiter-portal/.env -f docker-compose.prod.yml'
  }
  stages {
    stage('Build')  { steps { sh "${COMPOSE} build" } }
    stage('Deploy') { steps { sh "${COMPOSE} up -d --remove-orphans" } }
    stage('Smoke-Test') {
      steps {
        sh 'sleep 8'
        sh "${COMPOSE} ps"
        sh "${COMPOSE} exec -T web wget -q -O /dev/null http://127.0.0.1/"
      }
    }
  }
  post { always { sh 'docker image prune -f' } }
}