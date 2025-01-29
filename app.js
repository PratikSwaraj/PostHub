const express = require('express');
const app = express();
const usermodel = require('./models/user');
const postmodel = require('./models/post');
require('dotenv').config();

const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

app.set("view engine","ejs");
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/',(req,res) => {
    res.render("index");
});

app.post("/register",async (req,res)=>{
    let {username, name ,email ,age ,password} = req.body;

    let user = await usermodel.findOne({email});
    if(user)
    res.status(500).send("User already registered");

    bcrypt.genSalt(10, (err,salt) => {
        bcrypt.hash(password, salt, async (err,hash) => {
            let user = await usermodel.create({
                username,
                name,
                email,
                age,
                password : hash
            });

            let token = jwt.sign({email: email, userid: user._id}, process.env.JWT_SECRET);
            res.cookie("token", token);
            res.send("Registered");
        })
    })
})

app.get('/login', (req,res) =>{
    res.render("login");
});

app.post("/login",async (req,res)=>{
    let {email, password} = req.body;

    let user = await usermodel.findOne({email});
    if(!user)
    res.status(500).send("Something went wrong");

    bcrypt.compare(password,user.password, function(err, result) 
    {
     if(result)
     {
     let token = jwt.sign({email: email, userid: user._id}, process.env.JWT_SECRET);
     res.cookie("token", token);
     res.status(200).redirect('/profile');
     }
     else
     res.redirect('/login');
    });
})

app.get('/logout', (req,res) =>{
    res.cookie("token", "");
    res.redirect('/login');
});

app.get('/profile', isLoggedIn, async (req,res) =>{
    let user = await usermodel.findOne({email: req.user.email}).populate("posts");
    res.render('profile',{user});
});

function isLoggedIn(req, res, next)
{
  if(req.cookies.token === "" )
  res.redirect("/login");
  else
  {
    let data = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    req.user = data;
    next();
  }
}

app.post('/post', isLoggedIn, async (req,res) =>{
    let user = await usermodel.findOne({email: req.user.email});
    let post = await postmodel.create({
        user: user._id,
        content: req.body.content
    })
    
    user.posts.push(post._id);
    await user.save();
    res.redirect('/profile');
});


app.get('/edit/:id', isLoggedIn, async (req,res) =>{
    let post = await postmodel.findOne({_id: req.params.id}).populate("user");
    res.render('edit', {post} );
});

app.post('/update/:id', isLoggedIn, async (req,res) =>{
    let post = await postmodel.findOneAndUpdate({_id: req.params.id}, {content: req.body.content});
    res.redirect('/profile');
});

app.get('/delete/:id', isLoggedIn, async (req,res) =>{
    let post = await postmodel.findOneAndDelete({_id: req.params.id});
    res.redirect('/profile');
});

app.get('/posts/:id', isLoggedIn, async (req,res) =>{
    let users = await usermodel.find().populate({
        path: 'posts',
        populate: { path: 'user' }
    });
    console.log(users);
    let loggeduser = await usermodel.findOne({_id: req.params.id});
    res.render('posts', {users,loggeduser});
});

app.post('/like/:id', isLoggedIn, async (req, res) => {
    let post = await postmodel.findById(req.params.id);
    post.likes = (post.likes || 0) + 1;
    await post.save();
    res.json({ likes: post.likes });
});

app.listen(3000);