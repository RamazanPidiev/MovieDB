import express from "express";
import { MongoClient, ObjectId } from 'mongodb';
import session from 'express-session';
const bcrypt = require('bcrypt');
declare module "express-session" {
    interface Session {
        name: string;
    }
}

const app = express();
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.set('port', 4000);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(session({
    secret: 'test123',
    resave: false,
    saveUninitialized: true
}));

let uri = "_MONGODBURI_";
let client = new MongoClient(uri);

interface Movie {
    name: string,
    myScore: number,
    image: string,
    description: string,
    username?: string
}

app.get('/', (req, res) => {
    res.render('index',{user: res.locals.name});
})

app.get('/login', (req, res) => {
    res.render('login');
})

app.post('/login', async (req, res) => {
    try {
        await client.connect();
        let login = req.body;
        let account = await client.db('test').collection('accounts').findOne({ username: login.name });
        if (!account || !(await bcrypt.compare(login.password, account.password))) {
            res.render('login', {
                message: 'Wrong username or password',
            });
            return;
        }
        req.session.name = login.name;
        res.redirect('/movies');
    } catch (e) {
        console.log(e);
    }
    finally {
        await client.close;
    }
})

app.get('/register', (req, res) => {
    res.render('register');
})

interface Account {
    username: string,
    password: string
}

app.post('/register', async (req, res) => {
    try {
        await client.connect();
        let account:Account = {
            username: req.body.name,
            password: await bcrypt.hash(req.body.password, 10)
        };
        let collection = await client.db('test').collection('accounts');
        let find = await collection.findOne({username: account.username});
        if (!find) {
            await collection.insertOne(account);
            let starter_movies : Movie[] = [
                {name: "The Matrix", myScore: 90, image: "https://cdn.shopify.com/s/files/1/0057/3728/3618/products/9fcc8387e9d47ab5af4318d7183f6d2b_19f7e1e1-3941-4c27-bad1-1f6dd70f35e0_480x.progressive.jpg?v=1573587594", description: "",username: req.body.name},
                {name: "Pulp Fiction", myScore: 100, image: "https://cdn.shopify.com/s/files/1/0057/3728/3618/products/pulpfiction.2436_500x749.jpg?v=1620048742", description: "",username: req.body.name},
                {name: "Monster Hunter", myScore: 5, image: "https://cdn.shopify.com/s/files/1/0057/3728/3618/products/monsterhunter.styleb.ar_500x749.jpg?v=1608660576", description: "",username: req.body.name},
                {name: "Blade Runner", myScore: 100, image:"https://cdn.shopify.com/s/files/1/0057/3728/3618/products/d9f6067d2406a7cfbf42a5fc4ae4cd9d_8174831c-db77-4608-9ae2-44aca8f2a6f5_500x749.jpg?v=1573585461", description:"",username: req.body.name}
            ];
            const movies = await client.db('test').collection('movies');
            await movies.insertMany(starter_movies);
            res.render('login', {
                message: 'Account created succesfully!',
            });
            return;
        } else {
            res.render('register', {
                message: 'Username already in use!',
            });
            return;
        }
    } catch (e) {
        console.log(e);
    }
    finally {
        await client.close;
    }
})

app.get('/logout',async (req, res) => {
    req.session.destroy((err) => {
        if (err) {
          console.error(err);
        } else {
          res.redirect('/');
        }
      });
})

//middleware
const middleware = async (req: any, res: any, next: any) => {
    try {
        await client.connect();
        const session_name = req.session;
        if (session_name) {
            const user = await client.db('test').collection('accounts').findOne({ username: session_name.name });
            if (user) {
                res.locals.name = req.session.name;
                next();
            } else {
                res.redirect('/login');
            }
        } else {
            res.redirect('/login');
        }
    } catch (e) {
        console.log(e);
        res.redirect('/login');
    } finally {
        client.close();
    }
}

app.get('/movies', middleware, async (req, res) => {
    try {
        await client.connect();
        let collection = await client.db('test').collection('movies');
        let movies = await collection.find({ username: req.session.name }).toArray();
        res.render('movies', { movies, user: res.locals.name  });
    }
    catch (e) {
        console.log(e);
    }
    finally {
        await client.close;
    }
})

app.get('/movie/:name', middleware, async (req, res) => {
    let name = req.params.name;
    try {
        await client.connect();
        let movie = await client.db('test').collection('movies').findOne({ name: name });
        res.render('movie', { movie });
    } catch (e) {
        console.log(e);
    }
    finally {
        await client.close;
    }
})

app.get('/addmovie', middleware, (req, res) => {
    res.render('addmovie',{user: res.locals.name});
})

app.post('/addmovie', middleware, async (req, res) => {
    let movie: Movie = {
        name: req.body.name,
        myScore: req.body.myScore,
        image: req.body.image,
        description: req.body.description,
        username: req.body.username
    };
    try {
        await client.connect();
        let collection = await client.db('test').collection('movies');
        await collection.insertOne(movie);
        res.redirect('/movies');
    } catch (e) {
        console.log(e);
    }
    finally {
        await client.close;
    }
})

app.get('/deleteMovie/:_id', middleware, async (req, res) => {
    try {
        await client.connect();
        let collection = await client.db('test').collection('movies');
        await collection.deleteOne({ _id: new ObjectId(req.params._id),username: req.session.name });
        res.redirect('/movies');
    } catch (e) {
        console.log(e);
    }
    finally {
        await client.close;
    }
})

app.listen(app.get('port'), () => console.log('[server] http://localhost:' + app.get('port')));