pipeline {
  agent any
  options { disableConcurrentBuilds() }
  triggers { githubPush() }
  environment {
    COMPOSE = 'docker compose -p mitarbeiter-portal --env-file /var/www/mitarbeiter-portal/.env -f docker-compose.prod.yml'
  }
  stages {
    stage('Build')  { steps { sh "${COMPOSE} build" } }
    stage('Database migrations') {
      steps {
        sh "${COMPOSE} up -d --wait db"
        sh '''
          set -eu
          for migration in apps/api/migrations/*.sql; do
            echo "Applying $migration"
            $COMPOSE exec -T db sh -c 'psql -v ON_ERROR_STOP=1 --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$migration"
          done
        '''
      }
    }
    stage('Import portal content') {
      steps {
        sh "${COMPOSE} run --rm --no-deps api npm run content:import -- deploy/portal-content.json"
      }
    }
    stage('Deploy') { steps { sh "${COMPOSE} up -d --remove-orphans" } }
    stage('Smoke-Test') {
      steps {
        sh 'sleep 8'
        sh "${COMPOSE} ps"
        sh "${COMPOSE} exec -T web wget -q -O /dev/null http://127.0.0.1/"
        sh "${COMPOSE} exec -T web wget -q -O /dev/null http://127.0.0.1/api/health"
      }
    }
  }
  post { always { sh 'docker image prune -f' } }
}