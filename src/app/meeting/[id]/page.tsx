export default function MeetingPage({params} : {params : {id : string}}){

    return(
        <div className="min-h-screen flex items-center justify-center">
            <h1 className="text-4xl ">hello you meeting begin in few moments
                <span className="bg-orange-400 p-2 rounded-2xl">{params.id}</span> </h1>
        </div>
    )
}   