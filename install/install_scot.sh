#!/bin/bash

### TODO
### stop/start daemons (controllable by flag?)


function add_scot_user {
    echo "- checking for existing scot user"
    if grep --quiet -c scot: /etc/passwd; then
        echo "- scot user exists"
    else
        useradd -c "SCOT User" -d $SCOTDIR -M -s /bin/bash scot
    fi
    
    if [[ $OS == "Ubuntu" ]]; then
        APACHE_GROUP="www-data"
    else
        APACHE_GROUP="apache"
    fi
    echo "- adding scot to $APACHE_GROUP group"
    usermod -a -G scot $APACHE_GROUP
}

function configure_logging {
    if [ ! -d $LOGDIR ]; then
        echo "- creating Log dir $LOGDIR"
        mkdir -p $LOGDIR
    fi

    echo "- ensuring proper log ownership/permissions of $LOGDIR"
    chown scot:scot $LOGDIR
    chmod g+w $LOGDIR

    if [ "$CLEARLOGS"  == "yes" ]; then
        for i in $LOGDIR/*; do
            echo "- clearing log $i"
            cat /dev/null > $i
        done
    fi

    echo "- creating $LOGDIR/scot.log"
    touch $LOGDIR/scot.log
    chown scot:scot $LOGDIR/scot.log

    if [ ! -e /etc/logrotate.d/scot ]; then
        echo "+ installing logrotate policy"
        cp $DEVDIR/install/src/logrotate/logrotate.scot /etc/logrotate.d/scot
    else 
        echo "= logrotate policy in place"
    fi
}

function get_config_files {
    if [[ "$SCOT_CONFIG_SRC" == "" ]];then
        SCOT_CONFIG_SRC="$DEVDIR/install/src"
    fi
    echo "-- examining config files"
    CFGFILES='
        mongo
        logger
        imap
        activemq
        enrichments
        flair.app
        flair_logger
        stretch.app
        stretch_logger
        game.app
        elastic
        backup
        scot_server
    '
    for file in $CFGFILES; do
        CFGDEST="$SCOTDIR/etc/${file}.cfg"
        CFGSRC="$SCOT_CONFIG_SRC/scot/${file}.cfg"
        if [[ -e $CFGDEST ]]; then
            echo "- config file $file already exists"
        else
            echo "- copying $CFGSRC to $CFGDEST"
            cp $CFGSRC $CFGDEST
        fi
    done

    if [[ $AUTHMODE == "Remoteuser" ]]; then
        cp $SCOT_CONFIG_SRC/scot/scot_env.remoteuser.cfg $SCOTDIR/etc/scot_env.cfg
    else
        cp $SCOT_CONFIG_SRC/scot/scot_env.local.cfg $SCOTDIR/etc/scot_env.cfg
    fi

}

function copy_documentation {
    echo "--"
    echo "-- Installing documentation"
    echo "--"

    if [[ "$SCOT_DOCS_DIR" == "" ]]; then
        SCOT_DOCS_DIR="$DEVDIR/docs/build/html"
    fi

    cp -r $SCOT_DOCS_DIR/* $SCOTDIR/public/docs
    echo "-- Documentation now available at https://localhost/docs/index.html"
}

function configure_startup {
    echo "--"
    echo "-- configuring SCOT startup"
    echo "--"
    SCOTSERVICES='scot scfd scepd'
    SRCDIR="$SCOT_CONFIG_SRC/scot"

    for service in $SCOTSERVICES; do
        if [[ $OS == "Ubuntu" ]]; then
            if [[ $OSVERSION == "16" ]]; then
                sysfile="${service}.service"
                target="/etc/systemd/system/$sysfile"
                if [[ "$REFRESH_INIT" == "yes" ]]; then
                    rm -f $target
                fi
                if [[ ! -e $target ]]; then
                    echo "-- installing $target"
                    cp $SRCDIR/$sysfile $target
                else
                    echo "-- $target exists, skipping..."
                fi
                systemctl daemon-reload
                systemctl enable $sysfile
            else
                if [[ "$REFRESH_INIT" == "yes" ]]; then
                    rm -f /etc/init.d/$service
                fi
                if [[ ! -e /etc/init.d/$service ]]; then
                    if [[ $service == "scot" ]]; then
                        echo "-- installing /etc/init.d/scot"
                        cp $SRCDIR/scot-init /etc/init.d/scot
                        chmod +x /etc/init.d/scot
                        sed -i 's=instdir='$SCOTDIR'=g' /etc/init.d/scot
                    else
                        echo "-- install /etc/init.d/$service"
                        /opt/scot/bin/${service}.pl > /etc/init.d/$service
                        chmod +x /etc/init.d/$service
                    fi
                fi
                echo "-- updating rc.d for $service"
                update-rc.d $service defaults
            fi
        else
            # echo "-- chkconfig adding $service"
            # chkconfig --add $service
            sysfile="${service}.service"
            target="/etc/systemd/system/$sysfile"
            if [[ "$REFRESH_INIT" == "yes" ]]; then
                rm -f $target
            fi
            if [[ ! -e $target ]]; then
                echo "-- installing $target"
                cp $SRCDIR/$sysfile $target
            else
                echo "-- $target exists, skipping..."
            fi
            systemctl daemon-reload
            systemctl enable $sysfile
        fi
    done
}

function install_private_modules {

    if [[ "$PRIVATE_SCOT_MODULES" == "" ]]; then
        PRIVATE_SCOT_MODULES="$DEVDIR/../Scot-Internal-Modules"
    fi

    if [[ -d $PRIVATE_SCOT_MODULES ]]; then
        echo "--- "
        echo "--- Running private module installer"
        echo "---"
        . $PRIVATE_SCOT_MODULES/install.sh
    else
        echo "~~~ No Scot private module directory found at $PRIVATE_SCOT_MODULES"
    fi
}

function remove_filestore {
    if [[ "$FILESTORE" == "" ]]; then
        FILESTORE="/opt/scotfiles"
    fi

    echo "- REMOVING EXISTING FILESTORE"
    if [ "$FILESTORE" != "/" ] && [ "$FILESTORE" != "/usr" ]
    then
        # try to prevent major catastrophe!
        echo " WARNING: You are about to delete $FILESTORE.  ARE YOU SURE? "
        read -n 1 -p "Enter y to proceed" NUKEIT
        if [[ $NUKEIT == "y" ]];
        then
            rm -rf  $FILESTORE
        else
            echo "$FILESTORE deletion aborted."
        fi
    else
        echo "Someone set filestore to $FILESTORE, so deletion skipped."
    fi
}

function configure_filestore {
    if [[ "$SFILESDEL" == "yes" ]]; then 
        remove_filestore
    fi
    if [[ "$FILESTORE" == "" ]]; then
        FILESTORE="/opt/scotfiles"
    fi
    if [[ -d $FILESTORE ]]; then
        echo "- filestore $FILESTORE already exists"
    else
        echo "- creating $FILESTORE"
        mkdir -p $FILESTORE
        echo "- ensuring ownership and permissions on $FILESTORE"
        chown scot $FILESTORE
        chgrp scot $FILESTORE
        chmod g+w  $FILESTORE
    fi
}

function configure_backup {
    
    if [ -d $BACKDIR ]; then
        echo "= backup directory $BACKDIR exists"
    else 
        echo "+ creating backup directory $BACKDIR "
        mkdir -p $BACKUPDIR
        mkdir -p $BACKUPDIR/mongo
        mkdir -p $BACKUPDIR/elastic
        chown -R scot:scot $BACKUPDIR
        chown -R elasticsearch:elasticsearch $BACKUPDIR/elastic
    fi
    echo "!!! Remember to add the backup to the crontab.  See Docs"
}

function stop_apache {
    if [[ $OS == "Ubuntu" ]]; then
        if [[ $OSVERSION == "14" ]]; then
            service apache2 stop
        else 
            systemctl stop apache2.service
        fi
    else
        systemctl stop httpd.service
    fi
}

function start_apache {
    if [[ $OS == "Ubuntu" ]]; then
        if [[ $OSVERSION == "14" ]]; then
            service apache2 start
        else 
            systemctl start apache2.service
        fi
    else
        systemctl start httpd.service
    fi
}

function stop_scot {
    if [[ $OS == "Ubuntu" ]]; then
        if [[ $OSVERSION == "14" ]]; then
            service scot stop
        else 
            systemctl stop scot.service
        fi
    else
        systemctl stop scot.service
    fi
}

function start_scot {
    if [[ $OS == "Ubuntu" ]]; then
        if [[ $OSVERSION == "14" ]]; then
            service scot start
        else 
            systemctl start scot.service
        fi
    else
        systemctl start scot.service
    fi
}

function setup_scot_admin {
    MONGOADMIN=$(mongo scot-prod --eval "printjson(db.user.count({username:'admin'}))" --quiet)
    
    if [[ "$MONGOADMIN" == "0" ]] || [[ "$RESETDB" == "yes" ]]; then
        echo "-------"
        echo "------- USER INPUT NEEDED"
        echo "-------"
        echo "------- Choose a SCOT Admin login Password "
        set='$set'
        HASH=`$SCOT_CONFIG_SRC/mongodb/passwd.pl`

        mongo scot-prod $SCOT_CONFIG_SRC/mongodb/admin_user.js
        mongo scot-prod --eval "db.user.update({username:'admin'}, {$set:{pwhash:'$HASH'}})"
    fi
}

function restart_daemons {

    if [[ "$SCOT_RESTART_DAEMONS" == "yes" ]] || [[ "$INSTMODE" != "SCOTONLY" ]]; then
            if [[ $OS == "Ubuntu" ]]; then
                if [[ $OSVERSION == "14" ]]; then
                    service scfd restart
                    service scepd restart
                else
                    systemctl restart scfd.service
                    systemctl restart scepd.service
                fi
            else
                systemctl restart scfd.service
                systemctl restart scepd.service
            fi
    fi
}

function install_scot {
    
    echo "---"
    echo "--- Installing SCOT software"
    echo "---"

    stop_scot
    stop_apache

    if [[ "$SCOTDIR" == "" ]]; then
        SCOTDIR="/opt/scot"
    fi
    if [[ $DELDIR == "yes" ]]; then
        echo "-- removing $SCOTDIR prior to install"
        rm -rf $SCOTDIR
    fi
    if [[ ! -d $SCOTDIR ]]; then
        echo "-- creating $SCOTDIR"
        mkdir -p $SCOTDIR
    fi

    add_scot_user

    echo "-- adjusting ownership/permissions of $SCOTDIR"
    chown scot:scot $SCOTDIR
    chmod 754 $SCOTDIR

    echo "-- copying SCOT to $SCOTDIR"
    TAROPTS="--exclude=pubdev --exclude-vcs"
    echo "-       TAROPTS are $TAROPTS"
    (cd $DEVDIR; tar $TAROPTS -cf - .) | (cd $SCOTDIR; tar xvf -)

    echo "-- assigning owner/permissions on $SCOTDIR"
    chown -R scot:scot $SCOTDIR
    chmod -R 755 $SCOTDIR/bin

    get_config_files    
    configure_logging
    copy_documentation
    configure_filestore
    configure_backup
    setup_scot_admin
    install_private_modules
    configure_startup
    restart_daemons
    start_scot
    start_apache
}