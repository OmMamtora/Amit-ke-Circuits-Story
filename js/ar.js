const params = new URLSearchParams(window.location.search);

const id = params.get("id");

const member = window.getCircuitMember(id);

const video = document.getElementById("memberVideo");

const btn = document.getElementById("visitBtn");

if(member){

    video.src = `assets/video/${member.id}.mp4`;

    btn.href = `member.html?id=${member.id}`;

}