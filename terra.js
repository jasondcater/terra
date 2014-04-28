(function(global){

    global.Terra = {

        debug : false,//turn on the uv map and axis helpers

        //Web GL, Three JS components
        camera : new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 ),
        projector : new THREE.Projector(),
        scene : new THREE.Scene(),
        renderer : new THREE.WebGLRenderer({antialias: true}), 
        viewPort : document.createElement("div"),

        //Navigation
        mousePosLock : [0,0],
        mousePosCurrent : [0,0],
        navigate : false,
        rotation : 0,
        cameraDistance : 1000,
        mousePosCurrent : [0,0], 
        mousePosLock : [0,0],

        //Graphics and Maps
        mapEarthDay : null,
        materialEarthDay : null, 

        //line materials
        centerAxisMaterial : new THREE.LineBasicMaterial({ color: 0xeaa51f, opacity: 0.8}),
        polarAxisMaterial : new THREE.LineBasicMaterial({ color: 0xcc00cc, opacity: 0.8}),
        sunLineMaterial : new THREE.LineBasicMaterial({ color: 0xf7d06b, opacity: 0.8}), 

        orbiterMarkerMaterial  : [new THREE.MeshBasicMaterial({color:0xea1f5d, wireframe:true, transparent:true, opacity:1, side:THREE.DoubleSide})], 

        sunMaterial : new THREE.MeshBasicMaterial({color:0xf7d06b, wireframe:false, transparent:true, overdraw:true}),

        //Geometry Constants
        earthAxialTilt : 23.439281,
        earthYearSeconds : (365.242 * 60 * 60 * 24),
        earthRadius : (6371/40), // in pixels
        realEarthRadius : (6371), //in km, diameter = 12742

        //Geometry 
        earth : null, 
        earthCenter : new THREE.Mesh(new THREE.Geometry(), new THREE.Material()), 
        eciCenter : new THREE.Mesh(new THREE.Geometry(), new THREE.Material()), //Earth Centered Inertial
        sun : null, 
        sunCenter : new THREE.Mesh(new THREE.Geometry(), new THREE.Material()), 

        initialize : function(stamp, debug){

        //set up materials

            this.mapEarthDay = THREE.ImageUtils.loadTexture("./earth_map.jpg");
            if(this.debug) this.mapEarthDay = THREE.ImageUtils.loadTexture("./uv_grid.jpg");

            this.mapEarthDay.wrapS = this.mapEarthDay.wrapT = THREE.RepeatWrapping;
            this.mapEarthDay.anisotropy = 16;

            var earthMat = new THREE.MeshLambertMaterial( { ambient: 0xbbbbbb, map: this.mapEarthDay } );
            earthMat.transparent = true;
            earthMat.blending = THREE[ "NoBlending" ];
            earthMat.blendSrc = THREE[ "ZeroFactor" ];
            earthMat.blendDst = THREE[ "OneMinusSrcAlphaFactor" ];
            earthMat.blendEquation = THREE.AddEquation;
            
            this.materialEarthDay = [

                earthMat
            ];

        //set up the geometry 
            var tilt = this.earthAxialTilt * Math.PI/180;

            this.earthCenter.rotation.z = tilt;

            //earth day center will deal with the hourly rotation of the planet.
            this.earth = THREE.SceneUtils.createMultiMaterialObject( new THREE.SphereGeometry( this.earthRadius, 48, 24 ), this.materialEarthDay );
            this.earthCenter.add(this.earth);
            this.scene.add(this.earthCenter);

            //the pole around which the earth rotates
            var polarAxis = new THREE.Geometry();
            polarAxis.vertices.push(new THREE.Vector3(0, -200, 0));
            polarAxis.vertices.push(new THREE.Vector3(0, 200, 0));
            var polarAx = new THREE.Line(polarAxis, this.polarAxisMaterial);
            this.earthCenter.add(polarAx);
            
            //aligned with the Y axis of the solar system.
            var centerAxis = new THREE.Geometry();
            centerAxis.vertices.push(new THREE.Vector3(0, -200, 0));
            centerAxis.vertices.push(new THREE.Vector3(0, 200, 0));
            var centerAx = new THREE.Line(centerAxis, this.centerAxisMaterial);
            this.scene.add(centerAx);

            //used for calibration
            var axis = new THREE.AxisHelper(50);//red is X, green is Y, blue is Z
            axis.position.set(200, 0, 200);
            if(this.debug) this.scene.add(axis);
            
            //used for calibration
            var eci = new THREE.AxisHelper(50);//red is X, green is Y, blue is Z
            eci.position.set(200, 0, -200);
            eci.rotation.x = -90*Math.PI/180;
            eci.rotation.z = 90*Math.PI/180;
            eci.rotation.y = -tilt;
            if(this.debug) this.scene.add(eci);

            this.sun = new THREE.Mesh(new THREE.SphereGeometry(24, 48, 24), this.sunMaterial);
            this.sun.position.z = -1000;
            this.sun.overdraw = true;
            this.sunCenter.add(this.sun);
            this.scene.add(this.sunCenter);
        
            var sunLine = new THREE.Geometry();
            sunLine.vertices.push(new THREE.Vector3(0, 0, 0));
            sunLine.vertices.push(new THREE.Vector3(0, 0, -1000));
            var sunLn = new THREE.Line(sunLine, this.sunLineMaterial);
            this.sunCenter.add(sunLn);

        //set up the render/camera/view
            this.renderer.setSize(window.innerWidth-100, window.innerHeight - 100);
            this.renderer.setClearColor(0x221d23, 1);

            //Mouse Navigation Events
            this.viewPort.onmousemove = function(e){
        
                Terra.mousePosCurrent[0] = e.pageX;
                Terra.mousePosCurrent[1] = e.pageY;
            }
            
            this.viewPort.onmousedown = function(e){
        
                Terra.mousePosLock[0] = e.pageX;
                Terra.mousePosLock[1] = e.pageY;
                Terra.navigate = true;
            }
            
            this.viewPort.onmouseup = function(e){
        
                Terra.navigate = false;
            }
        
            this.viewPort.appendChild(this.renderer.domElement);
            document.body.appendChild(this.viewPort);

            //3D Rendering Context
            this.projector = new THREE.Projector();
            
            this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
            this.camera.position.x = 0;
            this.camera.position.y = 800;
            this.camera.position.z = 0;

            this.scene.add( new THREE.AmbientLight( 0xffffff ) );

            this.animate();

            //parse the timestamp
            stamp = parseInt(stamp);
            if(isNaN(stamp) || (stamp === undefined)){
                
                stamp = new Date();
                stamp = parseInt((stamp.getTime() / 1000).toFixed(0));
            }

            this.rotateEarth(stamp);
        },

        rotateEarth : function(stamp){

            //vernal equinox
            var eq = new Date();
            eq.setUTCFullYear(2013);
            eq.setUTCMonth(2);
            eq.setUTCDate(20);
            eq.setUTCHours(11);
            eq.setUTCMinutes(2);
            eq.setUTCSeconds(0);

            var earthRotationPerSecOfDay = 360 / (24*60*60);

            var eqGMTHour = eq.getUTCHours();
            var eqGMTMin = eq.getUTCMinutes();
            var eqGMTSec = eq.getUTCSeconds();
            //this rotation is overwritten by timeOfDayDegreeRotation, but still serves as a zero / origin mark
            var springEquinoxDayRotation = earthRotationPerSecOfDay * ((eqGMTHour * 60 * 60) + (eqGMTMin * 60) + eqGMTSec);
            
            var dt = new Date(Math.round(stamp*1000));
            var secondsBetween = (dt.getTime() - eq.getTime()) / 1000;
            var siderealDegreeRotation = secondsBetween * (360 / this.earthYearSeconds);

            this.sunCenter.rotation.y = siderealDegreeRotation * Math.PI/180;

            var currentGMTHour = dt.getUTCHours();
            var currentGMTMin = dt.getUTCMinutes();
            var currentGMTSec = dt.getUTCSeconds();

            var timeOfDayDegreeRotation = earthRotationPerSecOfDay * ((currentGMTHour * 60 * 60) + (currentGMTMin * 60) + currentGMTSec);
            this.earth.rotation.y = (siderealDegreeRotation + timeOfDayDegreeRotation) * Math.PI/180;
        },

        render : function(){

            if(this.navigate){
        
                var yaw = this.mousePosCurrent[0] - this.mousePosLock[0];
                
                this.camera.position.x = Math.cos( yaw / 100 ) * 800;
                this.camera.position.z = Math.sin( yaw / 100 ) * 800;
                
                var pitch = this.mousePosLock[1] - this.mousePosCurrent[1];
                
                if(pitch > 0 && pitch < 360){
        
                    this.camera.position.y = Math.cos( pitch / 100 ) * 800;
                }
            }
            
            this.camera.lookAt(this.scene.position);
            this.renderer.render(this.scene, this.camera);
        },

        onWindowResize : function(){
        
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize( window.innerWidth, window.innerHeight );
        },

        animate : function(){

            requestAnimationFrame(Terra.animate);
            Terra.render();
        }
    }
})(this);