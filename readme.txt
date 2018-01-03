# sliver-integration-transaction-service

## Ubuntu dependencies

```
sudo apt-get install nodejs
sudo apt-get install npm
npm install web3@0.20.1
npm install node-schedule
npm install forever -g

```

## Config

```
rename to config_template.cfg to config.cfg

cron job format in `exe_freq` follows https://github.com/node-schedule/node-schedule

```

## Run service

```

forever run_theta_transaction_service.js

```
